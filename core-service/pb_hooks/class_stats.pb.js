/// <reference path="../pb_data/types.d.ts" />

// GET /api/classes/{id}/stats : dasbor mentor (hanya mentor pemilik kelas).
routerAdd("GET", "/api/classes/{id}/stats", (e) => {
  const classId = e.request.pathValue("id");
  let cls;
  try {
    cls = $app.findRecordById("classes", classId);
  } catch (_) {
    throw new NotFoundError("Kelas tidak ditemukan");
  }
  if (cls.getString("mentor") !== e.auth.id) {
    throw new ForbiddenError("Hanya mentor pemilik kelas yang dapat melihat statistik");
  }

  const enrollments = $app.findRecordsByFilter("enrollments", "class = {:c}", "", 0, 0, { c: classId });
  const lessons = $app.findRecordsByFilter("lessons", "class = {:c}", "", 0, 0, { c: classId });
  let sum = 0, completed = 0;
  enrollments.forEach((r) => {
    const p = r.getInt("progress");
    sum += p;
    if (p >= 100) completed++;
  });

  return e.json(200, {
    class_id: classId,
    participants: enrollments.length,
    completed: completed,
    average_progress: enrollments.length ? Math.round(sum / enrollments.length) : 0,
    lessons: lessons.length,
    mentor_points: e.auth.getInt("credibility_points"),
  });
}, $apis.requireAuth());
