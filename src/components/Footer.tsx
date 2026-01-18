/**
 * Footer - Minimal, Clean Design
 */

import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="border-t border-white/5 bg-black py-12 px-4 md:px-8 lg:px-12">
      <div className="container mx-auto max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-8">
          <div>
            <h3 className="text-xl font-bold text-white mb-4" style={{ fontFamily: "var(--font-heading)" }}>
              Masterful
            </h3>
            <p className="text-sm text-[#A6A6A6]">
              Connecting homeowners with trusted local professionals.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-white text-sm">For Customers</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/services" className="text-sm text-[#A6A6A6] hover:text-white transition-colors">
                  Browse Services
                </Link>
              </li>
              <li>
                <Link to="/#how-it-works" className="text-sm text-[#A6A6A6] hover:text-white transition-colors">
                  How It Works
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-white text-sm">For Professionals</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/signup?intended_role=provider_pending_verification" className="text-sm text-[#A6A6A6] hover:text-white transition-colors">
                  Become a Pro
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-white text-sm">Company</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/privacy" className="text-sm text-[#A6A6A6] hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-sm text-[#A6A6A6] hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8">
          <p className="text-sm text-[#A6A6A6] text-center">
            &copy; {new Date().getFullYear()} Masterful. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
