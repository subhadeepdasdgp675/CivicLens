const footerLinks = [
  {
    heading: "Platform",
    links: ["Report Issue", "Explore Issues", "Departments", "Dashboard"],
  },
  {
    heading: "Resources",
    links: ["How It Works", "FAQ", "Contact Us", "Privacy Policy"],
  },
];

const Footer = () => (
  <footer className="border-t bg-card">
    <div className="civic-container py-12">
      <div className="grid gap-10 md:grid-cols-3">
        {/* Brand */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">CL</span>
            </div>
            <span className="text-lg font-semibold text-foreground">Civic Lens</span>
          </div>
          <p className="max-w-xs text-caption text-muted-foreground">
            Empowering citizens to report and track civic issues for cleaner, safer, and
            better-maintained neighborhoods.
          </p>
        </div>

        {/* Link columns */}
        {footerLinks.map((col) => (
          <div key={col.heading}>
            <h4 className="mb-4 text-caption font-semibold text-foreground">
              {col.heading}
            </h4>
            <ul className="space-y-2">
              {col.links.map((link) => (
                <li key={link}>
                  <a
                    href="#"
                    className="text-caption text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-10 border-t pt-6 text-center text-label text-muted-foreground">
        © {new Date().getFullYear()} Civic Lens. All rights reserved.
      </div>
    </div>
  </footer>
);

export default Footer;
