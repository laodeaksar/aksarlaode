export const staffInviteTemplate = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>You've Been Invited</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h1 style="margin-bottom:8px">You've been invited</h1>
  <p style="color:#6b7280;margin-top:0">Hi {{ name }}, you have been invited to join the admin panel as <strong>{{ role }}</strong>.</p>
  <p>Click the button below to set your password and activate your account. This link expires in <strong>24 hours</strong>.</p>
  <a href="{{ inviteLink }}"
     style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">
    Accept Invitation
  </a>
  <p style="color:#6b7280;font-size:12px;margin-top:32px">
    If you weren't expecting this invitation, you can safely ignore this email.
  </p>
</body>
</html>
`;
