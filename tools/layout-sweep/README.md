# ตรวจหน้าล้นจอ (layout sweep)

รันแอปทั้งตัวด้วย Firebase ปลอม (`fbstub.js`) + ข้อมูลทดสอบปลอม (`fix.js`, ไม่มีข้อมูลลูกค้าจริง) แล้วเปิดทุกหน้าใน `src/core/router.js` ที่ความกว้างจอที่กำหนด รายงานหน้าที่ล้นแนวนอนหรือมี error

```
npx vite --config tools/layout-sweep/vite.config.js
node tools/layout-sweep/sweep.cjs 320
```
