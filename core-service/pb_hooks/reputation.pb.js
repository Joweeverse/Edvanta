/// <reference path="../pb_data/types.d.ts" />

// Setiap pendaftaran siswa baru menambah 1 poin kredibilitas pada mentor kelas.
onRecordAfterCreateSuccess((e) => {
  e.next();
  try {
    const cls = $app.findRecordById("classes", e.record.getString("class"));
    if (cls.getString("mentor") === e.record.getString("user")) return; // mentor mendaftar ke kelas sendiri: tanpa poin
    const mentor = $app.findRecordById("users", cls.getString("mentor"));
    mentor.set("credibility_points", mentor.getInt("credibility_points") + 1);
    $app.save(mentor);
  } catch (err) {
    console.log("reputasi gagal diperbarui:", err);
  }
}, "enrollments");