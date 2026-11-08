import MotionProvider from "@/components/motion/MotionProvider";

// same sliding highlight as studio, needs the same motion setup
export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return <MotionProvider>{children}</MotionProvider>;
}
