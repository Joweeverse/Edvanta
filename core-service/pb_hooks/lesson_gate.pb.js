/// <reference path="../pb_data/types.d.ts" />

// Isi materi (content, video_url, pdf) hanya terlihat oleh mentor pemilik kelas dan
// siswa yang terdaftar. Pihak lain (mentor lain, pemanggil API key) hanya melihat kurikulum.
onRecordEnrich((e) => {
  const auth = e.requestInfo ? e.requestInfo.auth : null;
  let allowed = false;
  if (auth) {
    try {
      const cls = $app.findRecordById("classes", e.record.getString("class"));
      if (cls.getString("mentor") === auth.id) {
        allowed = true;
      } else {
        $app.findFirstRecordByFilter(
          "enrollments", "user = {:u} && class = {:c}", { u: auth.id, c: cls.id });
        allowed = true;
      }
    } catch (_) {}
  }
  if (!allowed) e.record.hide("content", "video_url", "pdf");
  e.next();
}, "lessons");
