export default function Footer() {
  return (
    <footer className="py-20 mt-20 border-t border-[rgba(255,255,255,0.1)] text-[#9ca3af] text-sm flex justify-between items-center">
      <div>
        <span className="block font-bold text-white mb-2 tracking-[0.05em] [font-variant:small-caps] [font-feature-settings:smcp]">
          liminal hq
        </span>
        <p>Designed & Coded in Canada 🍁</p>
      </div>

      <div className="text-right">
        <p>&copy; 2026 Liminal HQ Inc.</p>
        <p className="mt-2">
          <a href="https://github.com/liminal-hq" className="hover:text-white transition-colors">
            GitHub
          </a>
        </p>
      </div>
    </footer>
  );
}
