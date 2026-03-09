import { Resend } from "resend";

export async function sendDraftEmail(params: {
  to: string;
  from: string;
  subject: string;
  post: string;
  editUrl: string;
}): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: params.from,
    to: params.to,
    subject: params.subject,
    text: `다음 게시일 09:00 자동게시 예정 초안입니다.\n\n수정 링크: ${params.editUrl}\n\n초안:\n${params.post}`,
  });
}
