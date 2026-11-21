/// <reference path="../pb_data/types.d.ts" />

// POST /api/classes/{id}/certificate
// Menerbitkan sertifikat hanya bila seluruh materi kelas sudah selesai.
routerAdd("POST", "/api/classes/{id}/certificate", (e) => {
  const user = e.auth;
  const classId = e.request.pathValue("id");

  let enrollment;
  try {
    enrollment = $app.findFirstRecordByFilter(
      "enrollments", "user = {:u} && class = {:c}", { u: user.id, c: classId });
  } catch (_) {
    throw new ForbiddenError("Anda belum terdaftar di kelas ini");
  }

  const lessons = $app.findRecordsByFilter("lessons", "class = {:c}", "", 0, 0, { c: classId });
  const done = enrollment.getStringSlice("completed_lessons").length;
  if (lessons.length === 0 || done < lessons.length) {
    throw new BadRequestError("Sertifikat terbit setelah seluruh materi selesai");
  }

  let cert;
  try {
    cert = $app.findFirstRecordByFilter(
      "certificates", "user = {:u} && class = {:c}", { u: user.id, c: classId });
  } catch (_) {
    const col = $app.findCollectionByNameOrId("certificates");
    cert = new Record(col);
    cert.set("user", user.id);
    cert.set("class", classId);
    cert.set("code", "EDV-" + $security.randomStringWithAlphabet(8, "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"));
    $app.save(cert);
  }

  const cls = $app.findRecordById("classes", classId);
  const mentor = $app.findRecordById("users", cls.getString("mentor"));
  return e.json(200, {
    code: cert.getString("code"),
    student: user.getString("name"),
    class_title: cls.getString("title"),
    mentor: mentor.getString("name"),
    issued_at: cert.getString("created"),
  });
}, $apis.requireAuth());
