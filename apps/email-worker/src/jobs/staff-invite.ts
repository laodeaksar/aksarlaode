import type { BaseProvider } from "@/providers/base.provider";
import type { EmailJobPayload } from "@/queues/email.queue";
import { render } from "@/templates/engine";
import { staffInviteTemplate } from "@/templates/staff-invite.html";

export async function handleStaffInvite(
  payload: EmailJobPayload["staff-invite"],
  provider: BaseProvider
) {
  const html = render(staffInviteTemplate, {
    name: payload.name,
    role: payload.role,
    inviteLink: payload.inviteLink,
  });

  return provider.send({
    to: payload.email,
    subject: `You've been invited as ${payload.role}`,
    html,
  });
}
