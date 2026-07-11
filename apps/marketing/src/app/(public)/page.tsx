import { Header } from './components/header';
import { HeroSection } from './components/hero-section';
import { Footer } from './components/footer';

const Home = () => {
    return (
        <div className="flex min-h-screen flex-col bg-background text-foreground">
            <Header />
            <HeroSection />
            <Footer />
        </div>
    );
};

export default Home;
