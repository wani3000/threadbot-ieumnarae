import Link from "next/link";
import ManualIngestForm from "@/components/ManualIngestForm";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1>정보올리기</h1>
      <p>여러 글을 복사/붙여넣기 후 저장하면 됩니다.</p>
      <p><Link href="/">대시보드로 돌아가기</Link></p>

      <section>
        <h2>직접올린글 저장</h2>
        <ManualIngestForm editToken={process.env.EDIT_TOKEN} />
      </section>
    </main>
  );
}
