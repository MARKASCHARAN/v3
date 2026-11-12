import AsciiDitherMedia from '@/components/ui/background-ascii-dither';

export default function Demo() {
  return (
    <div className="relative h-screen w-full bg-background text-foreground">
      <AsciiDitherMedia mode="ascii" />
    </div>
  );
}

