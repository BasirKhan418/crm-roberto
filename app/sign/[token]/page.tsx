interface SignPageProps {
  params: Promise<{ token: string }>;
}

export default async function SignPage({ params }: SignPageProps) {
  const { token } = await params;

  return (
    <main className="mx-auto w-full max-w-[720px] bg-white p-6">
      <h1 className="text-xl font-semibold">Sign Quote</h1>
      <p className="mt-2 text-sm text-muted-foreground">Token: {token}</p>
    </main>
  );
}
