# Mochi App publisher app
# Copyright © 2026 Mochisoft OÜ
# SPDX-License-Identifier: AGPL-3.0-only
# This file is part of Mochi, licensed under the GNU AGPL v3 with the
# Mochi Application Interface Exception - see license.txt and license-exception.md.

# decimal(value) -> bool: whether value is a non-empty ASCII decimal string.
# This is what .isdigit() was reached for, but isdigit() also accepts Unicode
# digit forms (Arabic-Indic "٣", Devanagari "३") that int() rejects,
# which aborts the action as a 500 instead of taking the guard's else branch.
def decimal(value):
    if not value:
        return False
    for c in value.elems():
        if c not in "0123456789":
            return False
    return True

# Compare two dotted version strings numerically (e.g. "1.11" > "1.9"), mirroring
# the core version_greater() comparator, which Starlark cannot call directly.
# Non-numeric segments count as 0.
def version_greater(a, b):
	pa = a.split(".")
	pb = b.split(".")
	for i in range(max(len(pa), len(pb))):
		na = int(pa[i]) if i < len(pa) and decimal(pa[i]) else 0
		nb = int(pb[i]) if i < len(pb) and decimal(pb[i]) else 0
		if na > nb:
			return True
		if na < nb:
			return False
	return False

# A track name is at most 50 characters of letters, digits, "-" and "_" -
# the one rule for every path that creates tracks (explicit create and
# version upload).
def track_valid(track):
	return len(track) <= 50 and track.replace("-", "").replace("_", "").isalnum()

# Number of most-recent versions to retain per app, regardless of track. Any
# version a track points at is always kept as well; everything older is pruned
# so the release archive stays bounded. Pruning runs on each upload and can be
# applied to the whole backlog via action_prune.
version_retention = 5

# prune_versions removes an app's versions that are neither pointed at by a
# track nor among the most-recent version_retention. Returns the number pruned.
def prune_versions(app_id):
	rows = mochi.db.rows("select version, file from versions where app=?", app_id) or []
	if len(rows) <= version_retention:
		return 0

	# Versions any track points at are always kept.
	keep = {}
	for t in mochi.db.rows("select version from tracks where app=? and version!=''", app_id) or []:
		keep[t["version"]] = True

	# Keep the most-recent version_retention versions by numeric order (the
	# version column is text, so select the maxima with version_greater rather
	# than sorting lexically).
	remaining = list(rows)
	for _ in range(version_retention):
		if not remaining:
			break
		latest = remaining[0]
		for r in remaining:
			if version_greater(r["version"], latest["version"]):
				latest = r
		keep[latest["version"]] = True
		remaining = [r for r in remaining if r["version"] != latest["version"]]

	# Prune the rest: record first, then the zip - and only when no other
	# version row still references the same file. Rows created before archives
	# got server-derived names can share one client-named zip across versions
	# or apps, and deleting it would break the surviving references.
	pruned = 0
	for r in rows:
		if not keep.get(r["version"]):
			mochi.db.execute("delete from versions where app=? and version=?", app_id, r["version"])
			if r["file"] and not mochi.db.row("select 1 from versions where file=?", r["file"]):
				mochi.file.delete(r["file"])
			pruned = pruned + 1
	return pruned

def database_upgrade(version):
	if version == 2:
		# Drop the broadcast tables left in the app data DB when broadcast state moved
		# to the per-app system DB - stale copies mislead diagnosis.
		for table in ["sequence", "log", "acknowledged", "received"]:
			mochi.db.execute("drop table if exists " + table)

# Create database
def database_create():
	mochi.db.execute("create table apps ( id text not null primary key, name text not null, privacy text not null default 'public', default_track text not null default 'Production', distribution text not null default 'published', updated integer not null default 0 )")
	mochi.db.execute("create table versions ( app references apps( id ), version text not null, file text not null, primary key ( app, version ) )")
	mochi.db.execute("create index versions_file on versions( file )")
	mochi.db.execute("create table tracks ( app references apps( id ), track text not null, version text not null, updated integer not null default 0, primary key ( app, track ) )")

# Resolve the "app" input for a write action or set an error and return None: id
# format (400 - mochi.entity.get raises on an ill-formed id), ownership (403),
# existence (404).
def sweep_uploads(keep):
	# Clear staging archives orphaned by an earlier run. Anything in flight for
	# a concurrent upload by the same user goes too, which is the same trade
	# apps/apps.star makes in sweep_packages(); the alternative is leaking them
	# forever, which is what happened before.
	for file in mochi.file.list("") or []:
		if file != keep and file.startswith("upload_") and file.endswith(".zip"):
			mochi.file.delete(file)

def require_owned_app(a):
	id = a.input("app")
	if not id or not (mochi.text.valid(id, "entity") or mochi.text.valid(id, "fingerprint")):
		a.error.label(400, "errors.invalid_app_id")
		return None
	if not mochi.entity.get(id):
		a.error.label(403, "errors.access_denied")
		return None
	app = mochi.db.row("select * from apps where id=?", id)
	if not app:
		a.error.label(404, "errors.app_not_found")
		return None
	return app

def action_list(a):
	apps = mochi.db.rows("select a.*, t.version from apps a left join tracks t on a.id = t.app and t.track = a.default_track")
	return {"data": {"apps": apps}}

def action_share(a):
	"""Public share page for one app. Share data only - never the version list, which is
	management data.

	Storage resolves to the entity owner only for an ANONYMOUS visitor; an authenticated
	one reads their own database, finds nothing for someone else's app, and takes the P2P
	branch below - a self-loop when the app is hosted here. Correct, but a round trip."""
	id = a.input("app")
	# mochi.remote.stream below aborts the action with a 500 on a malformed id,
	# and this route is public. Same guard as require_owned_app.
	if not id or not (mochi.text.valid(id, "entity") or mochi.text.valid(id, "fingerprint")):
		a.error.label(400, "errors.invalid_app_id")
		return

	# Local rows first: the publisher's own visit, and the app's own server.
	app = mochi.db.row("select * from apps where id=?", id)
	tracks = []
	if app:
		if app.get("distribution") == "restricted":
			a.error.label(404, "errors.app_not_found")
			return
		tracks = [t for t in mochi.db.rows("select * from tracks where app=?", app["id"]) if t.get("version")]
	else:
		# Not in this database: ask the publisher over P2P, as apps/apps.star does.
		# event_information refuses restricted apps itself.
		s = mochi.remote.stream(id, "publisher", "information", {"app": id})
		if not s:
			a.error.label(404, "errors.app_not_found")
			return
		status = s.read()
		if type(status) != "dict" or status.get("status") != "200":
			a.error.label(404, "errors.app_not_found")
			return
		app = s.read()
		# The responder chose what to send, so bind it to the app that was
		# asked for rather than trusting the id it reports back.
		if type(app) != "dict" or app.get("id") != id:
			a.error.label(502, "errors.app_not_found")
			return
		remote_tracks = s.read()
		if type(remote_tracks) == "list":
			tracks = [t for t in remote_tracks if type(t) == "dict" and t.get("version")]

	fp = mochi.entity.fingerprint(id)
	app["fingerprint"] = fp[:3] + "-" + fp[3:6] + "-" + fp[6:]
	return {"data": {"app": app, "tracks": tracks, "versions": [],
		"administrator": False, "share": True, "publisher": id}}

# View an app (supports both authenticated and anonymous access)
def action_view(a):
	id = a.input("app")
	if not id or len(id) > 51:
		a.error.label(400, "errors.invalid_app_id")
		return
	app = mochi.db.row("select * from apps where id=?", id)
	if not app:
		a.error.label(404, "errors.app_not_found")
		return

	fp = mochi.entity.fingerprint(app["id"])
	app["fingerprint"] = fp[:3] + "-" + fp[3:6] + "-" + fp[6:]
	tracks_all = mochi.db.rows("select * from tracks where app=?", app["id"])

	# Get publisher identity for share string
	publisher = a.user.identity.id if a.user and a.user.identity else ""

	# Anyone may publish, so managing an app is a question of owning it, not of
	# holding a role - the same test every write action here already uses. The
	# database is per-user, so this row is already the caller's own; the check
	# is what separates the owner's management view from the share view.
	owned = a.user and mochi.entity.get(app["id"])

	# Whether a version may be installed onto this server is a different
	# question, and core answers it - api_app_package_install gates on
	# administrator or apps_install_user. Mirror that rather than reusing the
	# ownership answer, as apps/apps.star does for can_install.
	installer = a.user and (a.user.role == "administrator" or mochi.setting.get("apps_install_user") == "true")

	# Not the owner: public share info only (filter empty tracks). Restricted
	# apps deny existence to non-owners so they have no public share page.
	if not owned:
		if app.get("distribution") == "restricted":
			a.error.label(404, "errors.app_not_found")
			return
		tracks = [t for t in tracks_all if t.get("version")]
		return {"data": {"app": app, "tracks": tracks, "versions": [], "administrator": False, "share": True, "publisher": publisher}}

	# The owner gets full management info, including empty tracks.
	# No SQL order-by: version is a text column, so SQLite sorts it lexically
	# ("0.10" before "0.9"). The web frontend sorts versions numerically.
	versions = mochi.db.rows("select * from versions where app=?", app["id"])
	return {"data": {"app": app, "tracks": tracks_all, "versions": versions, "administrator": installer, "share": False, "publisher": publisher}}

# Create new app
def action_create(a):
	name = a.input("name")
	if not mochi.text.valid(name, "name"):
		a.error.label(400, "errors.invalid_app_name")
		return

	privacy = a.input("privacy")
	if not mochi.text.valid(privacy, "privacy"):
		a.error.label(400, "errors.invalid_privacy")
		return

	distribution = a.input("distribution", "published")
	if distribution not in ("published", "restricted"):
		a.error.label(400, "errors.invalid_distribution")
		return

	id = mochi.entity.create("app", name, privacy)
	if not id:
		a.error.label(500, "errors.failed_to_create_app_entity")
		return

	mochi.db.execute("insert into apps ( id, name, privacy, distribution ) values ( ?, ?, ?, ? )", id, name, privacy, distribution)

	# Create default tracks
	mochi.db.execute("insert into tracks ( app, track, version ) values ( ?, 'Production', '' )", id)
	mochi.db.execute("insert into tracks ( app, track, version ) values ( ?, 'Development', '' )", id)

	return {"data": {"id": id, "name": name}}

# Create a version
def action_version_create(a):
	app = require_owned_app(a)
	if app == None:
		return
	id = app["id"]

	# Tracks to update, defaulting to the app's default track when none are
	# specified. Validated up front, before the package is installed and the
	# archive stored: the upload path must not mint track names that
	# action_track_create would reject.
	tracks = []
	tracks_input = a.input("tracks")
	if tracks_input:
		for track in tracks_input.split(","):
			track = track.strip()
			if not track:
				continue
			if not track_valid(track):
				a.error.label(400, "errors.invalid_track_name")
				return
			tracks.append(track)
	else:
		tracks = [app.get("default_track", "Production")]

	# The archive is stored under a server-derived name once the version is
	# known; the client filename is never used for storage, since client-named
	# archives let two versions or two apps share one file (overwritten bytes,
	# cross-linked rows, pruning a still-referenced zip).
	if not a.input("file"):
		a.error.label(400, "errors.file_name_invalid")
		return

	file = "upload_" + mochi.random.alphanumeric(8) + ".zip"
	a.upload("file", file)

	# mochi.app.package.install raises rather than returning falsy on every
	# failure path, and a Starlark error aborts the action, so the deletes below
	# never run and that archive is orphaned. Sweep what earlier runs left.
	# After the upload, not before: mochi.file.list aborts when the app's file
	# root does not exist yet, and the upload is what creates it.
	sweep_uploads(file)

	# Validate paths match existing version (unless force=true)
	force = a.input("force") == "yes"
	if not force:
		new_info = mochi.app.package.get(file)
		if not new_info:
			mochi.file.delete(file)
			a.error.label(400, "errors.failed_to_read_app_info_from_archive")
			return

		# Get the semantically-latest existing version. The version column is text,
		# so sorting in SQL would order lexically ("0.9" after "0.10"); pick the max
		# with the numeric comparator instead.
		existing = None
		for row in mochi.db.rows("select version, file from versions where app=?", app["id"]):
			if not existing or version_greater(row["version"], existing["version"]):
				existing = row
		if existing and existing["file"] and mochi.file.exists(existing["file"]):
			old_info = mochi.app.package.get(existing["file"])
			if old_info and old_info.get("paths"):
				new_paths = new_info.get("paths") or []
				old_paths = old_info.get("paths") or []
				if new_paths != old_paths:
					mochi.file.delete(file)
					a.error.label(400, "errors.paths_mismatch", expected=str(old_paths), got=str(new_paths))
					return

	install = a.input("install") == "yes"
	version = mochi.app.package.install(app["id"], file, not install)
	if not version:
		mochi.file.delete(file)
		a.error.label(500, "errors.failed_to_install_app_version")
		return

	# Set the installed version as the system default
	if install:
		mochi.app.version.set(app["id"], version, "")

	# Store the archive under a name derived from the app and version, so
	# different apps and versions can never collide and re-uploading the same
	# version overwrites its archive in place (same-version redeploys).
	storage = app["id"] + "_" + version + ".zip"
	a.upload("file", storage)
	mochi.file.delete(file)

	# Repoint the version row at this archive. A re-upload can leave a
	# previous archive under a legacy client-supplied name; delete it once no
	# other version references it.
	previous = mochi.db.row("select file from versions where app=? and version=?", app["id"], version)
	mochi.db.execute("replace into versions ( app, version, file ) values ( ?, ?, ? )", app["id"], version, storage)
	if previous and previous["file"] and previous["file"] != storage:
		if not mochi.db.row("select 1 from versions where file=?", previous["file"]):
			mochi.file.delete(previous["file"])

	# Point the chosen tracks at this version, stamping updated the same as
	# action_track_set (replace would otherwise reset it to the default 0).
	now = mochi.time.now()
	for track in tracks:
		mochi.db.execute("replace into tracks ( app, track, version, updated ) values ( ?, ?, ?, ? )", app["id"], track, version, now)

	# Enforce the retention policy now that the new version is assigned to its
	# tracks (so it is always in the keep-set).
	prune_versions(app["id"])

	return {"data": {"version": version, "app": app, "tracks": tracks}}

# Apply the retention policy across every app in one pass (admin one-off for the
# existing backlog; ongoing pruning happens automatically on each upload).
def action_prune(a):
	# No role test: the publisher database is per-user, so this only ever walks
	# the caller's own apps. Pruning old versions of an app you published is
	# part of managing it, and anyone may publish.
	total = 0
	for app in mochi.db.rows("select id from apps") or []:
		total = total + prune_versions(app["id"])
	return {"data": {"pruned": total}}

# Create a new track
def action_track_create(a):
	app = require_owned_app(a)
	if app == None:
		return
	id = app["id"]

	track = a.input("track")
	if not track or not track_valid(track):
		a.error.label(400, "errors.invalid_track_name")
		return

	version = a.input("version", "")
	if len(version) > 50:
		a.error.label(400, "errors.invalid_version")
		return

	# Verify version exists (only if provided)
	if version:
		v = mochi.db.row("select 1 from versions where app=? and version=?", id, version)
		if not v:
			a.error.label(404, "errors.version_not_found")
			return

	# Check track doesn't already exist
	existing = mochi.db.row("select 1 from tracks where app=? and track=?", id, track)
	if existing:
		a.error.label(400, "errors.track_already_exists")
		return

	mochi.db.execute("insert into tracks (app, track, version) values (?, ?, ?)", id, track, version)
	return {"data": {"track": track, "version": version}}

# Set which version a track points to
def action_track_set(a):
	app = require_owned_app(a)
	if app == None:
		return
	id = app["id"]

	track = a.input("track")
	if not track or len(track) > 50:
		a.error.label(400, "errors.invalid_track_name")
		return

	version = a.input("version")
	if not version or len(version) > 50:
		a.error.label(400, "errors.invalid_version")
		return

	# Verify version exists
	v = mochi.db.row("select 1 from versions where app=? and version=?", id, version)
	if not v:
		a.error.label(404, "errors.version_not_found")
		return

	# Verify track exists
	t = mochi.db.row("select 1 from tracks where app=? and track=?", id, track)
	if not t:
		a.error.label(404, "errors.track_not_found")
		return

	now = mochi.time.now()
	mochi.db.execute("update tracks set version=?, updated=? where app=? and track=?", version, now, id, track)
	return {"data": {"track": track, "version": version}}

# Delete a track
def action_track_delete(a):
	app = require_owned_app(a)
	if app == None:
		return
	id = app["id"]

	track = a.input("track")
	if not track or len(track) > 50:
		a.error.label(400, "errors.invalid_track_name")
		return

	# Don't allow deleting the default track
	if track == app["default_track"]:
		a.error.label(400, "errors.cannot_delete_the_default_track")
		return

	mochi.db.execute("delete from tracks where app=? and track=?", id, track)
	return {"data": {"deleted": track}}

# Set the default track for an app
def action_default_track_set(a):
	app = require_owned_app(a)
	if app == None:
		return
	id = app["id"]

	track = a.input("track")
	if not track or len(track) > 50:
		a.error.label(400, "errors.invalid_track_name")
		return

	# Verify track exists
	t = mochi.db.row("select 1 from tracks where app=? and track=?", id, track)
	if not t:
		a.error.label(404, "errors.track_not_found")
		return

	mochi.db.execute("update apps set default_track=? where id=?", track, id)
	return {"data": {"default_track": track}}

# The "message" strings in these event handlers are P2P diagnostics, not
# user-facing text: callers branch on "status" and render their own labels. Keep
# them English.

# Receive a request for information about an app
# Private apps are accessible if the requester knows the publisher ID.
# Apps with distribution='restricted' refuse to serve metadata to remote callers.
def event_information(e):
	# Prefer the explicit "app" field in content; fall back to the routed "to"
	# header so callers that stream directly to the app entity (and send empty
	# content) keep working. The @publisher flow needs the explicit field
	# because the stream target is the publisher entity, not the app.
	app_id = e.content("app") or e.header("to")
	if not app_id or len(app_id) > 51:
		return e.write({"status": "400", "message": "App ID required"})
	a = mochi.db.row("select * from apps where id=?", app_id)
	if not a:
		return e.write({"status": "404", "message": "App not found"})
	if a.get("distribution") == "restricted":
		return e.write({"status": "403", "message": "This app is private"})

	e.write({"status": "200"})
	e.write({"id": a["id"], "name": a["name"], "privacy": a["privacy"], "default_track": a["default_track"]})
	e.write(mochi.db.rows("select track, version from tracks where app=?", a["id"]))

# Receive a request to download an app
# Private apps are accessible if the requester knows the publisher ID.
# Apps with distribution='restricted' refuse to serve the package to remote callers.
def event_get(e):
	app_id = e.content("app") or e.header("to")
	if not app_id:
		return e.write({"status": "400", "message": "App ID required"})
	a = mochi.db.row("select * from apps where id=?", app_id)
	if not a:
		return e.write({"status": "404", "message": "App not found"})
	# e.header("local") is true only for an in-process self-loop stream, so the
	# local app-update path can fetch a restricted app while remote peers are
	# refused.
	if a.get("distribution") == "restricted" and not e.header("local"):
		return e.write({"status": "403", "message": "This app is private"})

	version = e.content("version")
	if not version or len(version) > 50:
		return e.write({"status": "400", "message": "Invalid version"})

	v = mochi.db.row("select * from versions where app=? and version=?", a["id"], version)
	if not v:
		return e.write({"status": "404", "message": "App version not found"})

	if not mochi.file.exists(v["file"]):
		return e.write({"status": "404", "message": "App version file not found"})

	e.write({"status": "200"})
	e.write.file(v["file"])

# Receive a request to get version for requested track
# Private apps are accessible if the requester knows the publisher ID.
# Apps with distribution='restricted' refuse to serve track info to remote callers.
# If no track specified, uses the app's default track
def event_version(e):
	app_id = e.content("app") or e.header("to")
	if not app_id:
		return e.write({"status": "400", "message": "App ID required"})
	a = mochi.db.row("select * from apps where id=?", app_id)
	if not a:
		return e.write({"status": "404", "message": "App not found"})
	# See event_get: in-process callers (a host's own app-update loopback) may
	# read a restricted app's track versions from the local publisher; remote
	# peers are still refused.
	if a.get("distribution") == "restricted" and not e.header("local"):
		return e.write({"status": "403", "message": "This app is private"})

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

# Set the distribution policy for an app (published/restricted)
def action_distribution_set(a):
	app = require_owned_app(a)
	if app == None:
		return
	id = app["id"]

	distribution = a.input("distribution")
	if distribution not in ("published", "restricted"):
		a.error.label(400, "errors.invalid_distribution")
		return

	now = mochi.time.now()
	mochi.db.execute("update apps set distribution=?, updated=? where id=?", distribution, now, id)
	return {"data": {"distribution": distribution}}
