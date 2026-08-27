// =============================================================
// main-backup.js — Main's snapshot store (Routine, Today, Weekly
// Review, Future Self, and the retired Self-Care data).
//
// The engine lives in snapshots.js; this file keeps the name
// `MainBackup` and the `mainbak:` prefix, which is where every
// snapshot already on this device is sitting.
//
// NOTE ON THE OLD BODY FORMAT. This store wrote a BARE state map
// where the other three wrote a {v,at,reason,keys} envelope.
// snapshots.js's get() normalises both, so snapshots taken before
// this change still restore.
//
// This store also gains shrink detection, which it never had: it
// was the one of the four with no before-drop trigger, so a cloud
// pull that deleted a month of journal entries was caught only by
// whatever the 5s debounce happened to catch afterwards — i.e. the
// damage.
//
// LOAD ORDER: data-registry.js, then snapshots.js, then this.
// =============================================================

(function (global) {
  'use strict';
  if (!global.Snapshots || !global.Snapshots.forApp) return;
  // Assigns global.MainBackup, per the registry's snapshots.global.
  global.Snapshots.forApp('main');
})(window);
