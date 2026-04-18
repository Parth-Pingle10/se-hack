import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center landing-bg relative">
      <div className="landing-grid absolute inset-0 pointer-events-none" />
      <div className="relative z-10 text-center px-6 fade-in-up">
        <Logo size="lg" className="justify-center mb-8" />
        <p className="text-8xl font-bold text-foreground/10 mb-4">404</p>
        <h1 className="text-xl font-bold text-foreground mb-2">Page not found</h1>
        <p className="text-sm text-muted-foreground mb-8 max-w-sm mx-auto">
          The route <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{location.pathname}</code> doesn't exist.
        </p>
        <Link to="/">
          <Button className="gap-2 rounded-xl shadow-sm">
            <ArrowLeft className="h-4 w-4" />
            Return to Home
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
