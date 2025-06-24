# --- Dockerfile ---
FROM oven/bun:1                        
WORKDIR /app

# คัดลอกไฟล์ทั้งหมด
COPY . .

# ติดตั้ง dependency (production)
RUN bun install --production

# รับพอร์ตจากตัวแปร PORT (Koyeb ตั้งให้) หรือใช้ 4000
ARG PORT
ENV PORT=${PORT:-4000}
EXPOSE ${PORT}

# รันแอป (ปรับ path ให้ตรงกับโปรเจกต์)
CMD ["bun", "run", "start"]
