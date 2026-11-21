/// <reference path="../pb_data/types.d.ts" />

// Sembunyikan kunci jawaban ("answer") di field "questions" dari semua pengguna
// kecuali mentor. Hanya mengubah respons API; data di database tidak berubah,
// dan endpoint /api/quizzes/{id}/submit tetap membaca kunci aslinya.
onRecordEnrich((e) => {
  const auth = e.requestInfo ? e.requestInfo.auth : null;
  const isMentor = auth && auth.getString("role") === "mentor";

  if (!isMentor) {
    const raw = e.record.get("questions");
    const questions = JSON.parse(typeof raw === "string" ? raw : toString(raw));
    for (let i = 0; i < questions.length; i++) {
      delete questions[i].answer;
    }
    e.record.set("questions", questions);
  }

  e.next();
}, "quizzes");
