/// <reference path="../pb_data/types.d.ts" />

// POST /api/quizzes/{id}/submit
// Body: { "answers": [0, 2, 1] }  (indeks jawaban per soal, sesuai urutan di field "questions")
// Tugas: cek siswa terdaftar, cek materi sebelumnya sudah selesai, hitung skor,
// simpan ke "attempts", dan (jika lulus) tandai materi selesai + hitung progres di "enrollments".
routerAdd("POST", "/api/quizzes/{id}/submit", (e) => {
  const user = e.auth;
  const quizId = e.request.pathValue("id");
  const answers = e.requestInfo().body.answers;

  if (!Array.isArray(answers)) {
    throw new BadRequestError("Field 'answers' harus berupa array");
  }

  let quiz;
  try {
    quiz = $app.findRecordById("quizzes", quizId);
  } catch (_) {
    throw new NotFoundError("Kuis tidak ditemukan");
  }

  const lesson = $app.findRecordById("lessons", quiz.getString("lesson"));
  const classId = lesson.getString("class");

  // 1) Siswa harus terdaftar di kelas ini
  let enr;
  try {
    enr = $app.findFirstRecordByFilter(
      "enrollments",
      "user = {:u} && class = {:c}",
      { u: user.id, c: classId }
    );
  } catch (_) {
    throw new ForbiddenError("Anda belum terdaftar di kelas ini");
  }

  const completed = enr.getStringSlice("completed_lessons");

  // 2) Materi dibuka berurutan: materi sebelumnya harus sudah selesai
  const prev = $app.findRecordsByFilter(
    "lessons",
    "class = {:c} && order < {:o}",
    "-order",
    1,
    0,
    { c: classId, o: lesson.getFloat("order") }
  );
  if (prev.length > 0 && completed.indexOf(prev[0].id) === -1) {
    throw new ForbiddenError("Selesaikan materi sebelumnya terlebih dahulu");
  }

  // 3) Hitung skor
  const raw = quiz.get("questions");
  const questions = JSON.parse(typeof raw === "string" ? raw : toString(raw));
  let correct = 0;
  for (let i = 0; i < questions.length; i++) {
    if (Number(answers[i]) === Number(questions[i].answer)) correct++;
  }
  const score = questions.length ? Math.round((correct * 100) / questions.length) : 0;
  const passed = score >= quiz.getInt("passing_score");

  // 4) Simpan percobaan
  const attempt = new Record($app.findCollectionByNameOrId("attempts"));
  attempt.set("user", user.id);
  attempt.set("quiz", quizId);
  attempt.set("score", score);
  attempt.set("passed", passed);
  $app.save(attempt);

  // 5) Jika lulus: tandai materi selesai dan hitung progres kelas
  let progress = enr.getFloat("progress");
  if (passed) {
    if (completed.indexOf(lesson.id) === -1) completed.push(lesson.id);
    const total = $app.countRecords("lessons", $dbx.hashExp({ class: classId }));
    progress = total ? Math.round((completed.length * 100) / total) : 0;
    enr.set("completed_lessons", completed);
    enr.set("progress", progress);
    $app.save(enr);
  }

  return e.json(200, {
    score: score,
    passed: passed,
    correct: correct,
    total: questions.length,
    progress: progress,
  });
}, $apis.requireAuth());
