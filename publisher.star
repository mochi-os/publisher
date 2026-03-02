# Mochi App publisher app
# Copyright Alistair Cunningham 2025

# Create database
def database_create():
	mochi.db.execute("create table apps ( id text not null primary key, name text not null, privacy text not null default 'public', default_track text not null default 'Production' )")
	mochi.db.execute("create table versions ( app references apps( id ), version text not null, file text not null, primary key ( app, version ) )")
	mochi.db.execute("create index versions_file on versions( file )")
	mochi.db.execute("create table tracks ( app references apps( id ), track text not null, version text not null, primary key ( app, track ) )")

# Upgrade database to specified schema version
def database_upgrade(version):
	if version == 2:
		mochi.db.execute("alter table apps add column default_track text not null default 'Production'")

# List apps
def action_list(a):
	apps = mochi.db.rows("select a.*, t.version from apps a left join tracks t on a.id = t.app and t.track = a.default_track order by a.name")
	return {"data": {"apps": apps}}

# View an app (supports both authenticated and anonymous access)
def action_view(a):
	id = a.input("app")
	if not id or len(id) > 51:
		a.error(400, "Invalid app ID")
		return
	app = mochi.db.row("select * from apps where id=?", id)
	if not app:
		a.error(404, "App not found")
		return

	app["fingerprint"] = mochi.entity.fingerprint(app["id"], True)
	tracks_all = mochi.db.rows("select * from tracks where app=? order by track collate nocase", app["id"])

	# Get publisher identity for share string
	publisher = a.user.identity.id if a.user and a.user.identity else ""

	# Check if user is authenticated and is an administrator
	is_admin = a.user and a.user.role == "administrator"

	# For anonymous users or non-admins, return public share info only (filter empty tracks)
	if not is_admin:
		tracks = [t for t in tracks_all if t.get("version")]
		return {"data": {"app": app, "tracks": tracks, "versions": [], "administrator": False, "share": True, "publisher": publisher}}

	# For administrators, return full management info including empty tracks
	versions = mochi.db.rows("select * from versions where app=? order by version", app["id"])
	return {"data": {"app": app, "tracks": tracks_all, "versions": versions, "administrator": True, "share": False, "publisher": publisher}}

# Create new app
def action_create(a):
	name = a.input("name")
	if not mochi.valid(name, "name"):
		a.error(400, "Invalid app name")
		return

	privacy = a.input("privacy")
	if not mochi.valid(privacy, "privacy"):
		a.error(400, "Invalid privacy")
		return

	id = mochi.entity.create("app", name, privacy)
	if not id:
		a.error(500, "Failed to create app entity")
		return

	mochi.db.execute("replace into apps ( id, name, privacy ) values ( ?, ?, ? )", id, name, privacy)

	# Create default tracks
	mochi.db.execute("insert into tracks ( app, track, version ) values ( ?, 'Production', '' )", id)
	mochi.db.execute("insert into tracks ( app, track, version ) values ( ?, 'Development', '' )", id)

	return {"data": {"id": id, "name": name}}

# Create a version
def action_version_create(a):
	id = a.input("app")
	if not id or len(id) > 51:
		a.error(400, "Invalid app ID")
		return
	app = mochi.db.row("select * from apps where id=?", id)
	if not app:
		a.error(404, "App not found")
		return

	file = a.input("file")
	if not mochi.valid(file, "filename"):
		a.error(400, "File name invalid")
		return

	a.upload("file", file)

	# Validate paths match existing version (unless force=true)
	force = a.input("force") == "yes"
	if not force:
		new_info = mochi.app.package.get(file)
		if not new_info:
			mochi.file.delete(file)
			a.error(400, "Failed to read app info from archive")
			return

		# Get the latest existing version
		existing = mochi.db.row("select file from versions where app=? order by version desc limit 1", app["id"])
		if existing and existing["file"] and mochi.file.exists(existing["file"]):
			old_info = mochi.app.package.get(existing["file"])
			if old_info and old_info.get("paths"):
				new_paths = new_info.get("paths") or []
				old_paths = old_info.get("paths") or []
				if new_paths != old_paths:
					mochi.file.delete(file)
					a.error(400, "Paths mismatch: expected " + str(old_paths) + ", got " + str(new_paths) + ". Use force=yes to override.")
					return

	install = a.input("install") == "yes"
	version = mochi.app.package.install(app["id"], file, not install)
	if not version:
		mochi.file.delete(file)
		a.error(500, "Failed to install app version")
		return

	# Set the installed version as the system default
	if install:
		mochi.app.version.set(app["id"], version, "")

	# Use insert or ignore to prevent duplicate version entries from concurrent requests
	mochi.db.execute("insert or ignore into versions ( app, version, file ) values ( ?, ?, ? )", app["id"], version, file)

	# Update specified tracks, or default to app's default track if none specified
	tracks_input = a.input("tracks")
	if tracks_input:
		tracks = tracks_input.split(",")
	else:
		tracks = [app.get("default_track", "Production")]

	for track in tracks:
		track = track.strip()
		if track:
			mochi.db.execute("replace into tracks ( app, track, version ) values ( ?, ?, ? )", app["id"], track, version)

	return {"data": {"version": version, "app": app, "tracks": tracks}}

# Create a new track
def action_track_create(a):
	id = a.input("app")
	if not id or len(id) > 51:
		a.error(400, "Invalid app ID")
		return
	app = mochi.db.row("select * from apps where id=?", id)
	if not app:
		a.error(404, "App not found")
		return

	track = a.input("track")
	if not track or len(track) > 50 or not track.replace("-", "").replace("_", "").isalnum():
		a.error(400, "Invalid track name")
		return

	version = a.input("version", "")
	if len(version) > 50:
		a.error(400, "Invalid version")
		return

	# Verify version exists (only if provided)
	if version:
		v = mochi.db.row("select 1 from versions where app=? and version=?", id, version)
		if not v:
			a.error(404, "Version not found")
			return

	# Check track doesn't already exist
	existing = mochi.db.row("select 1 from tracks where app=? and track=?", id, track)
	if existing:
		a.error(400, "Track already exists")
		return

	mochi.db.execute("insert into tracks (app, track, version) values (?, ?, ?)", id, track, version)
	return {"data": {"track": track, "version": version}}

# Set which version a track points to
def action_track_set(a):
	id = a.input("app")
	if not id or len(id) > 51:
		a.error(400, "Invalid app ID")
		return
	app = mochi.db.row("select * from apps where id=?", id)
	if not app:
		a.error(404, "App not found")
		return

	track = a.input("track")
	if not track or len(track) > 50:
		a.error(400, "Invalid track name")
		return

	version = a.input("version")
	if not version or len(version) > 50:
		a.error(400, "Invalid version")
		return

	# Verify version exists
	v = mochi.db.row("select 1 from versions where app=? and version=?", id, version)
	if not v:
		a.error(404, "Version not found")
		return

	# Verify track exists
	t = mochi.db.row("select 1 from tracks where app=? and track=?", id, track)
	if not t:
		a.error(404, "Track not found")
		return

	mochi.db.execute("update tracks set version=? where app=? and track=?", version, id, track)
	return {"data": {"track": track, "version": version}}

# Delete a track
def action_track_delete(a):
	id = a.input("app")
	if not id or len(id) > 51:
		a.error(400, "Invalid app ID")
		return
	app = mochi.db.row("select * from apps where id=?", id)
	if not app:
		a.error(404, "App not found")
		return

	track = a.input("track")
	if not track or len(track) > 50:
		a.error(400, "Invalid track name")
		return

	# Don't allow deleting the default track
	if track == app["default_track"]:
		a.error(400, "Cannot delete the default track")
		return

	mochi.db.execute("delete from tracks where app=? and track=?", id, track)
	return {"data": {"deleted": track}}

# Set the default track for an app
def action_default_track_set(a):
	id = a.input("app")
	if not id or len(id) > 51:
		a.error(400, "Invalid app ID")
		return
	app = mochi.db.row("select * from apps where id=?", id)
	if not app:
		a.error(404, "App not found")
		return

	track = a.input("track")
	if not track or len(track) > 50:
		a.error(400, "Invalid track name")
		return

	# Verify track exists
	t = mochi.db.row("select 1 from tracks where app=? and track=?", id, track)
	if not t:
		a.error(404, "Track not found")
		return

	mochi.db.execute("update apps set default_track=? where id=?", track, id)
	return {"data": {"default_track": track}}

# Receive a request for information about an app
# Private apps are accessible if the requester knows the publisher ID
def event_information(e):
	app_id = e.header("to")
	if not app_id:
		return e.write({"status": "400", "message": "App ID required"})
	a = mochi.db.row("select * from apps where id=?", app_id)
	if not a:
		return e.write({"status": "404", "message": "App not found"})

	e.write({"status": "200"})
	e.write({"id": a["id"], "name": a["name"], "privacy": a["privacy"], "default_track": a["default_track"]})
	e.write(mochi.db.rows("select track, version from tracks where app=?", a["id"]))

# Receive a request to download an app
# Private apps are accessible if the requester knows the publisher ID
def event_get(e):
	app_id = e.header("to")
	if not app_id:
		return e.write({"status": "400", "message": "App ID required"})
	a = mochi.db.row("select * from apps where id=?", app_id)
	if not a:
		return e.write({"status": "404", "message": "App not found"})

	version = e.content("version")
	if not version or len(version) > 50:
		return e.write({"status": "400", "message": "Invalid version"})

	v = mochi.db.row("select * from versions where app=? and version=?", a["id"], version)
	if not v:
		return e.write({"status": "404", "message": "App version not found"})

	if not mochi.file.exists(v["file"]):
		return e.write({"status": "404", "message": "App version file not found"})

	e.write({"status": "200"})
	e.write_from_file(v["file"])

# Receive a request to get version for requested track
# Private apps are accessible if the requester knows the publisher ID
# If no track specified, uses the app's default track
def event_version(e):
	app_id = e.header("to")
	if not app_id:
		return e.write({"status": "400", "message": "App ID required"})
	a = mochi.db.row("select * from apps where id=?", app_id)
	if not a:
		return e.write({"status": "404", "message": "App not found"})

	# Use default track if none specified
	track = e.content("track", "")
	if not track:
		track = a["default_track"]
	if len(track) > 50:
		return e.write({"status": "400", "message": "Invalid track"})

	t = mochi.db.row("select version from tracks where app=? and track=?", a["id"], track)
	if not t:
		return e.write({"status": "404", "message": "App track not found"})

	# Get all tracks for 0.3+ clients
	# TODO(0.3-cleanup): Remove version/track fields when all servers are 0.3
	all_tracks = mochi.db.rows("select track, version from tracks where app=?", a["id"])

	e.write({"status": "200"})
	e.write({
		"version": t["version"],           # Backward compat for 0.2 clients
		"track": track,                     # Backward compat for 0.2 clients
		"default_track": a["default_track"],
		"tracks": all_tracks                # All tracks for 0.3+ clients
	})

# Service function: Get tracks for an app (for local calls from other apps)
def function_tracks(context, app_id):
	a = mochi.db.row("select * from apps where id=?", app_id)
	if not a:
		return None
	tracks = mochi.db.rows("select track, version from tracks where app=?", app_id)
	return {
		"default_track": a["default_track"],
		"tracks": {t["track"]: t["version"] for t in tracks}
	}
