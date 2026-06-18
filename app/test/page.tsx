import { ArrowRight, CheckCircle2, Clock3, FileText, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

export default function TestPage() {
  return (
    <main className="min-h-svh bg-background px-4 py-20 text-foreground sm:px-6 lg:px-8">
      <section className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="space-y-6">
          <div className="space-y-4">
            <Badge variant="secondary" className="gap-2">
              <ShieldCheck className="size-3.5" />
              Dummy authenticated session
            </Badge>
            <div className="max-w-3xl space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Assessment workspace
              </h1>
              <p className="text-base leading-7 text-muted-foreground sm:text-lg">
                This is the candidate test screen placeholder. The real test
                engine, questions, timer, and submissions can plug into this
                layout later.
              </p>
            </div>
          </div>

          <Card>
            <CardHeader className="gap-3">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1.5">
                  <CardTitle className="text-xl">Frontend Developer Test</CardTitle>
                  <CardDescription>
                    Read the instructions, then begin when the test module is ready.
                  </CardDescription>
                </div>
                <Badge variant="outline">Not started</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md border bg-muted/30 p-4">
                  <Clock3 className="mb-3 size-5 text-muted-foreground" />
                  <p className="text-sm font-medium">Duration</p>
                  <p className="mt-1 text-2xl font-semibold">45 min</p>
                </div>
                <div className="rounded-md border bg-muted/30 p-4">
                  <FileText className="mb-3 size-5 text-muted-foreground" />
                  <p className="text-sm font-medium">Sections</p>
                  <p className="mt-1 text-2xl font-semibold">3</p>
                </div>
                <div className="rounded-md border bg-muted/30 p-4">
                  <CheckCircle2 className="mb-3 size-5 text-muted-foreground" />
                  <p className="text-sm font-medium">Progress</p>
                  <p className="mt-1 text-2xl font-semibold">0%</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="font-medium">Readiness</span>
                  <span className="text-muted-foreground">Setup complete</span>
                </div>
                <Progress value={18} />
              </div>

              <Separator />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  The start action is intentionally disabled until real test
                  logic is connected.
                </p>
                <Button className="w-full sm:w-auto" disabled>
                  Start test
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Candidate checklist</CardTitle>
              <CardDescription>Current dummy flow status.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                "OTP screen rendered",
                "Toast feedback connected",
                "Theme preference saved",
                "Test route available",
              ].map((item) => (
                <div className="flex items-center gap-3" key={item}>
                  <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <CheckCircle2 className="size-4" />
                  </span>
                  <span className="text-sm font-medium">{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Next integration</CardTitle>
              <CardDescription>
                Reserved for backend auth and database-backed attempts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Replace dummy local storage with a real session.</p>
              <p>Load assigned test data from the database layer.</p>
              <p>Persist answers and submission state per candidate.</p>
            </CardContent>
          </Card>
        </aside>
      </section>
    </main>
  );
}
