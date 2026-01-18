import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import plumbingIcon from "@/assets/plumbing-icon.jpg";
import electricianIcon from "@/assets/electrician-icon.jpg";
import gardeningIcon from "@/assets/gardening-icon.jpg";
import cleaningIcon from "@/assets/cleaning-icon.jpg";
import { ArrowRight } from "lucide-react";

const categories = [
  {
    id: "plumbing",
    name: "Plumbing",
    description: "Expert plumbers for repairs, installations, and emergencies",
    image: plumbingIcon,
    proCount: 1200,
  },
  {
    id: "electrician",
    name: "Electricians",
    description: "Licensed electricians for all your electrical needs",
    image: electricianIcon,
    proCount: 980,
  },
  {
    id: "gardening",
    name: "Gardening",
    description: "Professional gardeners for landscaping and maintenance",
    image: gardeningIcon,
    proCount: 850,
  },
  {
    id: "cleaning",
    name: "House Cleaning",
    description: "Trusted cleaners for a spotless home",
    image: cleaningIcon,
    proCount: 1500,
  },
];

const ServiceCategories = () => {
  return (
    <section className="py-20 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-muted/20 to-transparent"></div>
      <div className="container mx-auto px-4 relative">
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="mb-4">
            Browse Our Services
          </h2>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Find the perfect professional for your home improvement needs
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {categories.map((category, index) => (
            <Link 
              key={category.id} 
              to={`/services/${category.id}`}
              className="animate-fade-in-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <Card className="group cursor-pointer overflow-hidden border border-border/50 hover:border-primary/50 transition-all duration-500 hover:shadow-xl bg-card/50 backdrop-blur-sm h-full flex flex-col hover:-translate-y-2">
                <div className="p-8 flex flex-col items-center text-center flex-1">
                  <div className="w-28 h-28 mx-auto mb-6 rounded-2xl overflow-hidden bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center shadow-lg group-hover:shadow-glow transition-all duration-500 group-hover:scale-110">
                    <img
                      src={category.image}
                      alt={category.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  </div>
                  <h3 className="text-2xl font-bold mb-3 group-hover:text-primary transition-colors duration-300">
                    {category.name}
                  </h3>
                  <p className="text-muted-foreground text-sm mb-6 leading-relaxed flex-1">
                    {category.description}
                  </p>
                  <div className="flex items-center justify-center gap-2 text-sm text-primary font-semibold mt-auto pt-4 border-t border-border/50 w-full group-hover:border-primary/50 transition-colors">
                    <span>{category.proCount}+ Pros Available</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform duration-300" />
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServiceCategories;
