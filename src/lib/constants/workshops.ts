export const MAX_ADVANCE_WORKSHOP_REGISTRATIONS = 2;
/** Required free time from one workshop's end to the next workshop's start. */
export const MIN_WORKSHOP_GAP_MINUTES = 60;
export const WORKSHOP_ADVANCE_CHECK_IN_MINUTES = {
  opensBefore: 15,
  closesBefore: 5,
} as const;

export const WORKSHOP_REGISTRATION_RULES = [
  `ลงทะเบียนได้สูงสุด ${MAX_ADVANCE_WORKSHOP_REGISTRATIONS} รอบ โดยต้องเป็นคนละภาควิชา ห้ามลงภาควิชาเดิมซ้ำ`,
  "กิจกรรมวันที่ 31 ตุลาคม 2569 เวลา 13.00–19.00 น. และวันที่ 1 พฤศจิกายน 2569 เวลา 09.00–17.00 น.",
  "ต้องเว้นระยะอย่างน้อย 60 นาทีหลังจบเวิร์กช็อปก่อนเริ่มรอบถัดไป เช่น ลงรอบ 13.00–14.00 น. รอบถัดไปเริ่มได้ตั้งแต่ 15.00 น.",
  "สแกน Check-In ที่จุดลงทะเบียนส่วนกลางก่อน แล้วจึงเช็กอินที่จุดลงทะเบียนเวิร์กช็อปของรอบที่จองไว้",
  "จุดลงทะเบียนเวิร์กช็อปเปิดก่อนเริ่มรอบ 15 นาที: ผู้ลงทะเบียนล่วงหน้าเช็กอินใน 10 นาทีแรก และผู้เข้าร่วมแบบ onsite ใน 5 นาทีสุดท้าย เช่น รอบ 13.00 น. ผู้ลงทะเบียนล่วงหน้าต้องเช็กอินเวลา 12.45–12.55 น. และ onsite เวลา 12.55–13.00 น.",
  "บูท M1, M2, L1 และ L2 มีทีมงาน Workshop และตัวแทนภาควิชาละ 1 คนช่วยดูแลกิจกรรม",
];
