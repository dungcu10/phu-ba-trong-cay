# Save mẫu từ bản cũ

Mỗi file do **chính mã của bản cũ** tạo ra (chơi vài lượt rồi lưu bằng serializer của bản đó), không lấy dữ liệu từ máy ai, không có thông tin cá nhân. Dùng để kiểm tra nâng cấp save (REVIEW 02 #1).

| File | Mã nguồn | saveVersion |
|---|---|---|
| `save-v4-d7c9ded.json` | d7c9ded (bản thử đang có trên máy chủ dự án) | 4 |
| `save-v7-27159a0.json` | 27159a0 | 7 |
| `save-v8-e17dd05.json` | e17dd05 (bản thử Chỉ thị 04) | 8 |
| `save-v9-9ef65c4.json` | 9ef65c4 (bản thử nháp nâng cấp v3 đợt 1, chưa có `budget`) | 9 |

Cách tạo lại: `git worktree add /tmp/old-<mã> <mã>`, nối `node_modules`, chạy `npx tsx tools/make-save-fixture.mts /tmp/old-<mã> <file>`.

- `save-v11-c48ac3c.json` — save đời 11 do code nhánh `feat/cto-07-cho-may-giao-dien` @ c48ac3c ghi (SaveManager thật): cấp 6, 30 lần thu hoạch Cúc Bông Gòn, 7 Bọ Rùa. Dùng cho migration 11→12 (chỉ thị 10).
