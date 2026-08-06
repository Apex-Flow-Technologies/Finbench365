import Image from 'next/image';

/**
 * The MyExams365 lockup.
 *
 * Two artwork files, swapped with CSS rather than by reading the theme in JS.
 * The brand navy sits at almost the same luminance as the dark-theme background
 * (#0B0C10), so on dark the book and the "E" would all but disappear — hence a
 * light variant. Doing the swap with `dark:` classes means both files are in the
 * markup and the correct one is shown before hydration, so there is no flash of
 * the wrong logo on first paint (which is what reading next-themes state here
 * would cause).
 */
export function Logo({
  className = 'h-8',
  priority = false,
}: {
  /** Height utility; width follows the aspect ratio. */
  className?: string;
  priority?: boolean;
}) {
  const common = `w-auto ${className}`;
  return (
    <>
      <Image
        src="/logo.png"
        alt="MyExams365"
        width={953}
        height={535}
        priority={priority}
        className={`${common} block dark:hidden`}
      />
      <Image
        src="/logo-dark.png"
        alt=""
        aria-hidden="true"
        width={953}
        height={535}
        priority={priority}
        className={`${common} hidden dark:block`}
      />
    </>
  );
}
