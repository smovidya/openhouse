# Pages

## 20 Oct

- landing
- ลงทะเบียน
  - หน้า login
  - form
  - pdpa
- เลือก workshop
  - list workshop
  - รายละเอียด workshop + เลือกสล็อตเวลา
- myid

## 26 Oct

- make a guide

## 28 Oct

- myid (เสร็จ)
  - prize
- staff
- qrcode page

## 30 Oct

- certification
- เปิดงาน

# Staff scanner pages

ใช้ backend จาก `ptsgrn/activities-completments` (branch นี้ rebase อยู่บนนั้น, ยัง dev อยู่) — ต้อง `bun run db:migrate:local` + `bun run workshops:seed`

## ต้องไปหาข้อมูล / ตัดสินใจ

- หน้าเช็คแลกของที่ระลึก (staff): ยังไม่ทำ
  - ตาราง Figma มี 4 คอลัมน์ (นิทรรศการ / เวิร์คช็อป / กิจกรรม / เวที) แต่เกณฑ์จริงมี 5 ข้อ
    (TCAS / กิจกรรมกลาง / บูธภาควิชา / เวิร์คช็อป / เวที) — ต้องออกแบบตารางใหม่
  - เช็คสตอรี่ + แฮชแท็กก่อนกดยืนยัน: checkbox ใน sheet? (backend ไม่ได้บันทึก)
  - ของรางวัลมีหลายชิ้นต่อขั้นได้ (rewardGifts) — ให้เลือกถ้ามีมากกว่า 1?
  - ไม่ผ่านขั้นไหนเลย / แลกไปแล้ว: แสดง error (REWARD_NOT_ELIGIBLE / ALREADY_REDEEMED)
- frame ที่ไม่มีกล้อง (2272:1227) แปลกๆ — ตอนนี้ถือว่าเป็นโหมดกรอกรหัส (มีแท็บ + ช่องกรอกเหมือนหน้าอื่น) ถาม designer อีกที

## ตัดสินใจแล้ว

- รหัส QR: 5 ตัวจาก `2345679ACDEFGHJKLMNPQRSTUVWXYZ%#@` (ไม่มีตัวเล็ก, ดู selfRegisterAttendee)
  - backend ไม่ได้เช็ค format (รับ `z.string()` แล้วหาแบบตรงตัว)
  - frontend (src/lib/qr-code.ts): แปลงเป็นตัวใหญ่ + เช็ค format ก่อนค้นหา; ตอน dev รับทุกรหัส เพราะ `dev-attendee-qr` ไม่ตรง format
  - ถ้า backend มี schema ของรหัสทีหลัง ให้ใช้อันนั้นแทน
- เวิร์คช็อป: picker แสดงทุกเวิร์คช็อป (staff เลือกเอง; permission จำกัดแค่บูธภาควิชา)
- เวิร์คช็อป: โหมดเพิ่มคน + คนที่ลงทะเบียนล่วงหน้ารอบนี้ = เช็คอินให้เลย (ไม่ error)
- เวิร์คช็อป: "ลบออก" (walk-in) ต้องยืนยันก่อน
- เวิร์คช็อป: id รอบใน D1 = `workshop-<slug>-<round>` (timeSlotId ใน src/lib/workshops.ts) เพราะไม่มี query คืน id รอบ
  ถ้า seed เปลี่ยนรูปแบบ id ต้องแก้ตาม
- ของที่ระลึก: เกณฑ์ / ชื่อขั้น / ของรางวัล ตาม protocol (src/lib/rewards.ts + tierRequirements)
- ของที่ระลึก: แลกได้ครั้งเดียว แลกแล้วล็อก; ประวัติการแลกเป็นระดับงาน ใหม่สุดก่อน; หน้าสแกนมีปุ่มย้อนกลับ
- ของที่ระลึก: sheet "รับของรางวัล" แสดงบูธที่ยังไม่ได้เก็บ (progress.checkpoints)

## ยังไม่มี backend (หน้าใช้ mock data ไปก่อน, ดู src/lib/mock/)

- อีเมลของผู้เข้าร่วม: ไม่มี lookup ไหนคืนอีเมล (อยู่ใน users) — `mockAttendeeEmail`
- ประวัติการแลกของรางวัล: ยังไม่มี query

## หน้า

- เช็คอินจุดลงทะเบียน — ใช้ได้จริง (อีเมลเป็น mock)
- เช็คอิน / เพิ่มคน บูธเวิร์คช็อป — ใช้ได้จริง (attendance API)
- รายชื่อผู้เข้าร่วมเวิร์คช็อป — ใช้ได้จริง (attendance API)
- /myid ภารกิจล่าของรางวัล — ใช้ได้จริง (getMyProgress)
- e2e: e2e/staff-scanner.e2e.ts, e2e/myid-rewards.e2e.ts
- เช็คแลกของที่ระลึก (staff) + ประวัติ — ยังไม่ทำ
- เช็คอินบูธนิทรรศการ — คนอื่นทำ

# Placeholder

- ~~ช่องทางข่าวสารงาน (เลือก >=1 หรือ >=0)~~
  ไม่ทันแล้ว
- รางวัล
