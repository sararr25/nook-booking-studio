import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import "@/studio.css";
import studio from "@/assets/studio.jpg";
import ines from "@/assets/artist-ines.jpg";
import tove from "@/assets/artist-tove.jpg";
import rafa from "@/assets/artist-rafa.jpg";
import betta from "@/assets/art/betta.webp";
import bubbles from "@/assets/art/bubbles.webp";
import staySoft from "@/assets/art/stay-soft.webp";
import breathe from "@/assets/art/breathe.webp";
import frog from "@/assets/art/frog.webp";
import koi from "@/assets/art/koi.webp";
import matches from "@/assets/art/matches.webp";
import wildflowers from "@/assets/art/wildflowers.webp";
import veiledMirror from "@/assets/art/veiled-mirror.webp";
import moonWave from "@/assets/art/moon-wave.webp";

export const Route = createFileRoute("/")({
  head: () => ({
    links: [{ rel: "icon", href: "/stillroom-mark.svg", type: "image/svg+xml" }],
    meta: [
      { title: "Stillroom Tattoo | Custom tattoos in Malmö" },
      {
        name: "description",
        content:
          "A considered space for custom tattoos in Malmö. Explore our artists and book your appointment.",
      },
      { property: "og:title", content: "Stillroom Tattoo | Malmö" },
      {
        property: "og:description",
        content: "A quieter place to make your mark. Custom tattoos, made with care in Malmö.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudioHome,
});

const artists = [
  { name: "Ines Marrow", specialty: "Blackwork & cover-ups", image: ines },
  { name: "Tove Lind", specialty: "Fine line & botanical", image: tove },
  { name: "Rafa Osei", specialty: "Colour & illustrative", image: rafa },
];
const flash = [
  { name: "Koi in the waves", style: "Colour", image: koi },
  { name: "Frog with a daisy", style: "Fine line", image: frog },
  { name: "Last match", style: "Illustrative", image: matches },
  { name: "Wildflowers", style: "Fine line", image: wildflowers },
  { name: "Veiled mirror", style: "Blackwork", image: veiledMirror },
  { name: "Moon tide", style: "Fine line", image: moonWave },
];

function StudioHome() {
  return (
    <div className="studio-site" id="top">
      <a className="studio-skip" href="#main">
        Skip to content
      </a>
      <header className="studio-header">
        <div className="studio-header-inner">
          <a className="studio-wordmark" href="#top" aria-label="Stillroom Tattoo, home">
            STILLROOM <span>TATTOO</span>
          </a>
          <nav className="studio-nav" aria-label="Studio navigation">
            <a href="#work">Work</a>
            <a href="#artists">Artists</a>
            <a href="#visit">Visit</a>
          </nav>
          <Link className="studio-owner-link" to="/auth" search={{ notice: undefined }}>
            Owner sign in <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </header>
      <main id="main">
        <section className="studio-hero" aria-labelledby="studio-title">
          <div className="studio-hero-copy">
            <p className="studio-overline">Custom tattoo · Malmö</p>
            <h1 id="studio-title">
              A quieter place to make your <em>mark.</em>
            </h1>
            <img className="studio-signature" src={staySoft} alt="stay soft, handwritten" />
            <p className="studio-hero-lead">
              Considered design, personal attention and work made to stay with you. Tell us what you
              have in mind. We&apos;ll take it from there.
            </p>
            <Link className="studio-button" to="/book">
              Book an appointment <ArrowRight aria-hidden="true" size={18} />
            </Link>
          </div>
          <div className="studio-hero-art" aria-hidden="true">
            <img className="studio-betta" src={betta} alt="" />
            <img className="studio-bubbles" src={bubbles} alt="" />
          </div>
          <div className="studio-hero-image">
            <img src={rafa} alt="Rafa, one of the artists at Stillroom Tattoo" />
            <span>The people behind the work</span>
          </div>
        </section>
        <div className="studio-ticker" aria-label="Studio specialities">
          <span>Fine line</span>
          <span>Blackwork</span>
          <span>Cover-ups</span>
          <span>Custom pieces</span>
          <span>By appointment</span>
        </div>
        <section className="studio-section studio-work" id="work" aria-labelledby="work-title">
          <div className="studio-section-heading">
            <div>
              <p className="studio-overline">From the flash sheet</p>
              <h2 id="work-title">
                A piece with a <em>point of view.</em>
              </h2>
            </div>
            <p>
              Every appointment begins with a conversation. Bring a clear idea, a handful of
              references, or just a feeling you want to put into form.
            </p>
          </div>
          <div className="studio-flash-grid">
            {flash.map((piece) => (
              <figure className="studio-flash" key={piece.name}>
                <img src={piece.image} alt={`${piece.name} tattoo flash design`} loading="lazy" />
                <figcaption>
                  {piece.name}
                  <span>{piece.style}</span>
                </figcaption>
              </figure>
            ))}
          </div>
          <Link className="studio-text-link" to="/book">
            Start your piece <ArrowRight aria-hidden="true" size={17} />
          </Link>
        </section>
        <section
          className="studio-section studio-artists"
          id="artists"
          aria-labelledby="artists-title"
        >
          <div className="studio-section-heading">
            <div>
              <p className="studio-overline">Meet the studio</p>
              <h2 id="artists-title">
                Good work is <em>personal.</em>
              </h2>
            </div>
            <p>
              Three artists, different hands, and the same care for the person wearing the work.
            </p>
          </div>
          <div className="studio-artist-grid">
            {artists.map((artist) => (
              <article className="studio-artist" key={artist.name}>
                <img src={artist.image} alt={`Portrait of ${artist.name}`} loading="lazy" />
                <div>
                  <h3>{artist.name}</h3>
                  <p>{artist.specialty}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="studio-visit" id="visit" aria-labelledby="visit-title">
          <div className="studio-visit-image">
            <img src={studio} alt="The warm, quiet interior of Stillroom Tattoo" loading="lazy" />
          </div>
          <div className="studio-visit-copy">
            <p className="studio-overline">Come as you are</p>
            <h2 id="visit-title">
              Room to feel at <em>home.</em>
            </h2>
            <img
              className="studio-signature studio-signature-light"
              src={breathe}
              alt="breathe, handwritten"
            />
            <p>
              A calm space to talk through your idea, ask every question and take your time. We work
              by appointment so your visit has our full attention.
            </p>
            <address>
              Ostergatan 14
              <br />
              Malmö, Sweden
            </address>
            <Link className="studio-button studio-button-light" to="/book">
              Book an appointment <ArrowRight aria-hidden="true" size={18} />
            </Link>
          </div>
        </section>
      </main>
      <footer className="studio-footer">
        <a className="studio-wordmark" href="#top">
          STILLROOM <span>TATTOO</span>
        </a>
        <p className="studio-footer-note">
          <img src={frog} alt="" aria-hidden="true" />
          Custom tattoo, made with care in Malmö. See you soon.
        </p>
        <div>
          <Link to="/book">Book an appointment</Link>
          <Link to="/auth" search={{ notice: undefined }}>
            Owner sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}
