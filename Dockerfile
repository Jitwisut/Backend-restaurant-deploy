# ---- Dockerfile ----
FROM oven/bun:1
WORKDIR /app

# คัดลอกโปรเจ็กต์ทั้งหมด
COPY . .

# ติดตั้ง dependency แบบ production
RUN bun install --production

# รับพอร์ตจากตัวแปร PORT (Koyeb เซ็ตให้อัตโนมัติ) ถ้าไม่มีใช้ 8000
ARG PORT
ENV PORT=${PORT:-4000}
EXPOSE ${PORT}

# คำสั่งรันแอป (ปรับ path ให้ตรงโปรเจ็กต์)
CMD ["bun", "run", "src/index.ts"]
