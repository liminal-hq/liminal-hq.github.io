import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import PhilosophySection from "@/components/PhilosophySection";
// import LabSection from "@/components/LabSection";
import WorkSection from "@/components/WorkSection";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="container-custom">
      <Header />

      <main>
        <HeroSection />
        <PhilosophySection />
        <WorkSection />
        {/* <LabSection /> */}
      </main>

      <Footer />
    </div>
  );
}
