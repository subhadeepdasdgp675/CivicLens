import { Upload, MapPin, Search } from "lucide-react";

const steps = [
  {
    icon: Upload,
    title: "Upload Photo",
    description:
      "Take a photo of the civic issue and upload it along with a brief description.",
  },
  {
    icon: MapPin,
    title: "Auto Assignment",
    description:
      "Your report is automatically routed to the right department based on your location.",
  },
  {
    icon: Search,
    title: "Track Resolution",
    description:
      "Follow the status from Pending to Resolved. Unresolved? It escalates automatically after 7 days.",
  },
];

const HowItWorks = () => (
  <section className="civic-section bg-card">
    <div className="civic-container text-center">
      <h2 className="mb-3 text-h2 text-foreground">How It Works</h2>
      <p className="mx-auto mb-12 max-w-xl text-body-lg text-muted-foreground">
        Three simple steps to make your city better.
      </p>
      <div className="grid gap-6 md:grid-cols-3">
        {steps.map((s, i) => (
          <div
            key={s.title}
            className="rounded-xl border bg-background p-8 civic-card-hover"
          >
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-accent">
              <s.icon className="h-7 w-7 text-accent-foreground" />
            </div>
            <span className="mb-2 block text-label text-muted-foreground">
              Step {i + 1}
            </span>
            <h3 className="mb-2 text-h3 text-foreground">{s.title}</h3>
            <p className="text-caption text-muted-foreground">{s.description}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorks;
