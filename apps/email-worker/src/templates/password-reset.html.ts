export const passwordResetTemplate = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Reset Your Password</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h1>Reset Your Password</h1>
  <p>Click the button below. This link expires in 15 minutes.</p>
  <a href="{{ resetLink }}"
     style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px">
    Reset Password
  </a>
  <p style="color:#6b7280;font-size:12px;margin-top:24px">
    If you didn't request this, ignore this email.
  </p>
</body>
</html>
`;
