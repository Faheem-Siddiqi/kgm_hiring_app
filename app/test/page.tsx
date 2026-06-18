export default function TestPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10 text-foreground">
      <section className="w-full max-w-2xl text-center">
        <p className="text-sm font-medium text-muted-foreground">Authenticated area</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          Your test will appear here.
        </h1>
      </section>
    </main>
  );
}
