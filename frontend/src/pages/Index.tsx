import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import HowItWorks from "@/components/HowItWorks";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";
import QuickReportBanner from "@/components/QuickReportBanner";

const Index = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <HeroSection />
    <QuickReportBanner />
    <HowItWorks />
    <CTASection />
    <Footer />
  </div>
);

export default Index;
