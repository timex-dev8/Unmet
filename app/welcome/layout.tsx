import MotionProvider from "@/components/motion/MotionProvider";

// The sign-in card uses the same sliding highlight as the Studio, so it needs the same motion setup.
export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return <MotionProvider>{children}</MotionProvider>;
}
