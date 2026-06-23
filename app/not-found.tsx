import Link from "next/link";
import { ArrowLeft, BriefcaseBusiness, Home, SearchX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function NotFound() {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <section className="mx-auto flex min-h-svh w-full max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid w-full gap-6 lg:grid-cols-[1fr_420px] lg:items-center">
          <div className="space-y-5">
            <Badge variant="secondary" className="w-fit gap-2">
              <SearchX className="size-3.5" />
              404
            </Badge>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">
                Page not found
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                The page you opened is unavailable, moved, or the link is no
                longer valid. Return to a known area and continue from there.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild>
                <Link href="/jobs">
                  <BriefcaseBusiness className="size-4" />
                  Open jobs
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/">
                  <Home className="size-4" />
                  Candidate portal
                </Link>
              </Button>
            </div>
          </div>

          <Card className="shadow-xs">
            <CardHeader>
              <div className="mb-3 flex size-11 items-center justify-center rounded-lg bg-muted text-foreground">
                <ArrowLeft className="size-5" />
              </div>
              <CardTitle>Useful links</CardTitle>
              <CardDescription>
                Choose the closest place to restart your hiring workflow.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Button asChild variant="outline" className="justify-start">
                <Link href="/jobs">Browse candidate-facing jobs</Link>
              </Button>
              <Button asChild variant="outline" className="justify-start">
                <Link href="/admin/auth-required">Open admin workspace</Link>
              </Button>
              <Button asChild variant="outline" className="justify-start">
                <Link href="/">Enter assessment access code</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
