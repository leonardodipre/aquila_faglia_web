interface ReadmeSection {
  title: string;
  paragraphs: string[];
}

const PARAMETER_SECTIONS: ReadmeSection[] = [
  {
    title: "Slip",
    paragraphs: [
      "Lo slip è lo spostamento cumulato lungo la faglia: misura quanta deformazione è stata rilasciata sul piano di faglia.",
      "Nei terremoti tende a concentrarsi in tempi brevi e su porzioni limitate della faglia; negli slow slip events cresce più lentamente e in modo più graduale.",
      "Da solo non descrive la rapidità del processo: va sempre letto insieme alla velocità di slip V.",
    ],
  },
  {
    title: "Slip Rate (V)",
    paragraphs: [
      "V è la velocità di slip, cioè la derivata temporale dello slip: è la variabile che separa meglio un regime lento da uno rapido.",
      "Nei terremoti V aumenta di molti ordini di grandezza rispetto al regime quasi-statico; negli slow slip resta bassa anche con possibili accelerazioni transitorie.",
    ],
  },
  {
    title: "State Variable (theta)",
    paragraphs: [
      "Theta è la variabile di stato RSF e rappresenta la memoria interna della superficie di faglia (evoluzione dei contatti asperità-asperità).",
      "In stasi tende a crescere per aging; durante slip rapido tende a decadere o riorganizzarsi rapidamente.",
      "Valori alti indicano in genere contatto più invecchiato/rafforzato, valori bassi una superficie più rinnovata e spesso più debole.",
    ],
  },
  {
    title: "RSF",
    paragraphs: [
      "RSF (rate-and-state friction) è la legge costitutiva che lega la resistenza d'attrito a V, theta e tensione normale efficace.",
      "Non è un semplice campo osservato: è la relazione fisica che calcola la trazione frizionale resistente.",
      "Può produrre instabilità stick-slip nei terremoti; negli slow slip il sistema resta più vicino alla soglia senza collasso dinamico completo.",
    ],
  },
  {
    title: "Tau",
    paragraphs: [
      "Tau è la trazione di taglio applicata alla faglia, cioè il carico meccanico che tende a farla scorrere.",
      "Se tau supera la resistenza frizionale il sistema accelera; vicino alla soglia critica può restare in slip lento/metastabile.",
      "Nei terremoti tau mostra tipicamente un calo più netto durante la rottura, mentre negli slow slip la variazione è più graduale.",
    ],
  },
  {
    title: "Aging Law",
    paragraphs: [
      "L'aging law è la legge di evoluzione di theta: descrive il recupero dello stato di contatto quando la faglia è ferma o scorre lentamente.",
      "Modella il rafforzamento progressivo durante la quiete e la riorganizzazione dei contatti durante lo slip.",
      "È centrale sia nella preparazione intersismica della rottura sia nell'evoluzione lenta degli slow slip events.",
    ],
  },
];

const DASHBOARD_NOTES = [
  "In Modelli Compare scegli run (V1-V4), epoca, campo fisico e snapshot.",
  "Validation è mostrata sopra, Original sotto, con allineamento spaziale su L'Aquila.",
  "La scala colori è unica e condivisa tra i due pannelli per confronto diretto.",
  "Con click su una patch, la selezione viene mappata sull'altra faglia e appare il grafico temporale con entrambe le curve.",
];

export function ReadmePage() {
  return (
    <section className="page-grid readme-grid">
      <section className="hero-panel rise">
        <div className="hero-copy">
          <p className="eyebrow">README Modelli</p>
          <h2>Come leggere i campi fisici e il confronto Original/Validation</h2>
          <p>
            Questa pagina riassume in modo operativo i parametri RSF mostrati nella dashboard e come interpretarli
            in chiave sismologica.
          </p>
        </div>
      </section>

      <section className="panel rise">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Uso rapido</p>
            <h3>Workflow consigliato nella dashboard</h3>
          </div>
        </div>
        <div className="readme-note-list">
          {DASHBOARD_NOTES.map((note) => (
            <div key={note} className="readme-note-card">
              {note}
            </div>
          ))}
        </div>
      </section>

      <section className="panel rise">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Parametri</p>
            <h3>Significato fisico dei campi</h3>
          </div>
        </div>
        <div className="readme-sections">
          {PARAMETER_SECTIONS.map((section) => (
            <article key={section.title} className="readme-card">
              <h4>{section.title}</h4>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </article>
          ))}
        </div>
      </section>

      <section className="panel rise">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Run fisiche</p>
            <h3>Quasi-static vs Quasi-dynamic</h3>
          </div>
        </div>
        <div className="readme-card">
          <p>
            Nella run quasi-static, <strong>tau_rsf</strong> è confrontata con una trazione elastica in equilibrio
            istantaneo.
          </p>
          <p>
            Nella run quasi-dynamic, la stessa <strong>tau_rsf</strong> entra in un bilancio con una correzione
            dinamica proporzionale alla velocità di slip (radiation damping), che riduce la trazione efficace
            disponibile per sostenere una rottura rapida.
          </p>
          <pre className="readme-equation">tau_el - tau_RSF - eta * V = 0</pre>
        </div>
      </section>

      <section className="panel rise">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Lettura sismologica</p>
            <h3>Schema interpretativo sintetico</h3>
          </div>
        </div>
        <div className="readme-card">
          <p>
            Il sistema RSF va letto come equilibrio instabile tra carico e resistenza: slip misura il risultato
            cumulato, V la rapidità, theta la memoria interna, tau il forcing, RSF la resistenza e aging law il
            recupero/degrado dello stato.
          </p>
          <p>
            Un terremoto è tipicamente associato a un aumento rapido di V, rilascio brusco di tau e riduzione
            efficace della resistenza; uno slow slip event mostra invece evoluzione più graduale con V più basso e
            sistema vicino alla soglia critica.
          </p>
        </div>
      </section>
    </section>
  );
}
