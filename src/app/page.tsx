import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import PhilosophySection from "@/components/PhilosophySection";
import WorkSection from "@/components/WorkSection";
import LabSection from "@/components/LabSection";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="container-custom">
      <Header />
      <HeroSection />
      <PhilosophySection />
      <WorkSection />
      <LabSection />
      <Footer />
    </div>
  );
}
