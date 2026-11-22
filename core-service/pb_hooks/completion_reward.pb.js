// Mentor mendapat +2 poin kredibilitas saat progres seorang siswa pertama kali mencapai 100%.
// Penanda "completion_rewarded" pada pendaftaran mencegah bonus diberikan berulang
// (misalnya bila mentor menambah materi sehingga progres turun lalu naik lagi).
onRecordUpdate((e) => {
  let reward = false;
  const field = e.record.collection().fields.getByName("completion_rewarded");

  if (field && e.record.getInt("progress") >= 100 && !e.record.getBool("completion_rewarded")) {
    e.record.set("completion_rewarded", true);
    reward = true;
  }

  e.next();

  if (!reward) return;
  try {
    const cls = $app.findRecordById("classes", e.record.getString("class"));
    if (cls.getString("mentor") === e.record.getString("user")) return; // mentor di kelas sendiri: tanpa bonus
    const mentor = $app.findRecordById("users", cls.getString("mentor"));
    mentor.set("credibility_points", mentor.getInt("credibility_points") + 2);
    $app.save(mentor);
  } catch (err) {
    console.log("bonus penyelesaian gagal diberikan:", err);
  }
}, "enrollments");