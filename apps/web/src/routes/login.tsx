import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import doctorLogo from "@/assets/doctor-logo.svg";
import bgPattern from "@/assets/figma-temp/a57fb6f5d09df55185bc4fee2167b90f10d18288.png";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";

export const Route = createFileRoute("/login")({
  component: RouteComponent,
});

function RouteComponent() {
  const [showSignIn, setShowSignIn] = useState(true);

  return (
    <div className="flex min-h-screen w-full bg-[#f8fafd]">
      {/* Left Side - Branding/Illustration */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col items-center justify-center p-12">
        {/* Background gradient and image pattern */}
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(138.283deg, rgb(40, 84, 135) 6.3567%, rgb(15, 52, 96) 76.045%)" }} />
          <div className="absolute inset-0 opacity-[0.02] overflow-hidden">
            <img alt="" className="absolute h-[152.07%] left-[-35.54%] max-w-none top-[-26.06%] w-[171%] object-cover" src={bgPattern} />
          </div>
        </div>

        {/* Content */}
        <div className="z-10 flex flex-col items-center justify-center w-full h-full pb-20">
          <img src={doctorLogo} alt="Doctor.com Logo" className="w-[300px] h-[120px] object-contain mb-28 -mt-20" />
          
          <div className="flex flex-col items-center w-full">
            <h1 
              className="text-[32px] font-medium text-white text-center w-full tracking-normal leading-normal"
              style={{ textShadow: "0px 0px 8px white" }}
            >
              L'intelligence au coeur du soin
            </h1>
            <p 
              className="text-[20px] text-[#c2e0ef] font-light text-center w-full mt-2 tracking-normal"
              style={{ textShadow: "0px 3px 3px rgba(15,52,96,0.59)" }}
            >
              Conçu pour simplifier la pratique médicale
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Form Container - Exact Figma Design */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 w-full lg:w-1/2">
        <div 
          className="relative w-full max-w-[533px] rounded-[0px] overflow-hidden"
          style={{ 
            height: "640px",
            background: "linear-gradient(180deg, #ffffff 0%, #f5f8fa 100%)"
          }}
        >
          {/* Background gradient overlay - matching Figma design */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(240,245,250,0.85) 50%, rgba(230,238,245,0.75) 100%)"
            }}
          />
          
          {/* Left side highlight effect */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "linear-gradient(160deg, rgba(255,255,255,0.4) 0%, transparent 40%, transparent 100%)"
            }}
          />

          {/* Form Content */}
          <div className="relative z-10 w-full h-full pt-[106px] pl-[80px] pr-[80px]">
            {showSignIn ? (
              <SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
            ) : (
              <SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}