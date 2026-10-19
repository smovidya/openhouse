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
- myid: ต้องมีลิงก์ลงทะเบียน workshop

## 26 Oct

- make a guide

## 28 Oct

- myid (เสร็จ)
  - prize
- staff
- staff registration: ใส่ invite code
- qrcode page
- certification

## 30 Oct

- เปิดงาน

# Placeholder

- ช่องทางข่าวสารงาน (เลือก >=1 หรือ >=0)
- รางวัล

# todo

- background loop static render
- userId index
- workshop seat counts ("จำนวน x/y"): workshops API has no per-slot registered count yet
  - add count per slot (new query, own file to avoid conflicts) + pull in TanStack Query, refetch every ~15s on workshop detail
- workshop change round: backend `changeWorkshopRound` (one db.batch: check new round ignoring old registration, cancel old + insert new only if eligible). Frontend swap is not atomic; slots fill in ~5 min last year
