'use client'

import { useEffect } from 'react'

// Mode d'emploi des administrateurs (bouton « Mode d'emploi » à côté du nom, en haut de l'interface manager).

const h2: React.CSSProperties = { fontSize: '1.05rem', fontWeight: 700, color: 'var(--terracotta)', margin: '1.75rem 0 0.6rem' }
const h3: React.CSSProperties = { fontSize: '0.95rem', fontWeight: 700, margin: '1rem 0 0.4rem' }
const p: React.CSSProperties = { margin: '0 0 0.7rem', lineHeight: 1.55 }
const list: React.CSSProperties = { margin: '0 0 0.8rem', paddingLeft: '1.3rem', lineHeight: 1.55 }
const li: React.CSSProperties = { marginBottom: '0.35rem' }
const note: React.CSSProperties = { background: '#FFF5F0', border: '1px solid #FDDCCA', borderRadius: '0.5rem', padding: '0.65rem 0.8rem', margin: '0 0 0.8rem', lineHeight: 1.5, fontSize: '0.92rem' }
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', margin: '0 0 0.9rem', fontSize: '0.88rem' }
const th: React.CSSProperties = { textAlign: 'left', padding: '0.45rem 0.55rem', background: '#F5EDE4', color: '#8B4513', borderBottom: '1px solid #EDE0D6', whiteSpace: 'normal' }
const td: React.CSSProperties = { padding: '0.45rem 0.55rem', borderBottom: '1px solid #F0E6DC', verticalAlign: 'top', whiteSpace: 'normal' }

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={table}>
        <thead><tr>{head.map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={{ ...td, fontWeight: j === 0 ? 600 : 400 }}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

export default function ManagerGuide({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [onClose])

  return (
    <div role="dialog" aria-modal="true" aria-label="Mode d'emploi administrateurs" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--bg)', overflowY: 'auto' }}>
      <div style={{ position: 'sticky', top: 0, background: 'var(--terracotta)', color: 'white', height: 56, padding: '0 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
        <div style={{ fontWeight: 700 }}>📖 Mode d&apos;emploi – administrateurs</div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.18)', color: 'white', border: 'none', borderRadius: '0.4rem', padding: '0.4rem 0.8rem', fontWeight: 600, cursor: 'pointer' }}>✕ Fermer</button>
      </div>

      <main style={{ padding: '1.25rem 1.25rem 3rem', maxWidth: 760, margin: '0 auto', color: 'var(--text)' }}>
        <p style={p}>
          L&apos;interface manager sert à vérifier et valider les saisies des employés, à suivre la caisse, le coffre et la banque,
          et à préparer les factures pour le comptable. Elle est réservée à Valérie et Nicolas et se compose de neuf onglets,
          décrits ci-dessous dans l&apos;ordre de la barre.
        </p>

      <p style={{ background: '#FFFBF7', border: '1px solid #eee', borderRadius: '0.5rem', padding: '0.6rem 0.8rem' }}>📅 <b>Dates</b> : dans le Dashboard, Dépenses, Encaissements, À payer, Fond de caisse, Banque, Coffre fort et Comptable, les champs « 📅 Du … au … » en haut de la liste (sur téléphone, derrière le bouton « 📅 Dates ») affichent les opérations d&apos;une période libre, avec les raccourcis Ce mois, Mois dernier, Ce trimestre et Cette année. Le ✕ revient à l&apos;affichage habituel. Les soldes restent calculés sur tout l&apos;historique.</p>
      <h2 style={h2}>1. Se connecter</h2>
        <ul style={list}>
          <li style={li}><b>Code PIN</b> : sur riad-anyssates-gestion.vercel.app/manager, saisissez le PIN. Vous êtes connectée en tant que Valérie.</li>
          <li style={li}><b>Lien personnel avec accès manager</b> : c&apos;est le cas de Nicolas. Son lien d&apos;employé ouvre directement l&apos;interface manager, à son nom.</li>
        </ul>
        <p style={p}>Toutes les saisies faites depuis l&apos;interface sont enregistrées au nom de la personne connectée. Le PIN se change dans Paramètres ; l&apos;accès manager d&apos;un employé se donne ou se retire dans Employés.</p>
        <p style={p}>Les tableaux sont larges : sur téléphone, faites-les défiler de gauche à droite avec le doigt.</p>

        <h3 style={h3}>Notifications 🔔</h3>
        <p style={p}>La cloche en haut de l&apos;écran affiche le nombre de nouveautés : chaque dépense, encaissement, mouvement de caisse ou du coffre saisi par un membre de l&apos;équipe, et chaque rapprochement de caisse enregistré (avec l&apos;écart éventuel). Vos propres saisies ne vous sont pas notifiées.</p>
        <p style={p}>Pour être prévenu(e) même appli fermée, ouvrez la cloche et touchez <b>📱 Recevoir les notifications sur cet appareil</b>, puis acceptez. Sur iPhone, ajoutez d&apos;abord l&apos;appli à l&apos;écran d&apos;accueil (Partager → « Sur l&apos;écran d&apos;accueil ») et ouvrez-la depuis l&apos;icône. À faire une fois sur chaque appareil.</p>

        <h2 style={h2}>2. Dashboard (📊)</h2>
        <p style={p}>Le Dashboard résume un mois. Changez de mois avec les flèches ‹ ›, ou revenez au mois en cours avec « Mois actuel ».</p>
        <ul style={list}>
          <li style={li}><b>Totaux du mois</b> : dépenses, encaissements, entrées et sorties du fond de caisse.</li>
          <li style={li}><b>En attente / Validés</b> : le nombre de saisies à vérifier. S&apos;il reste des « En attente », allez dans Dépenses ou Encaissements pour les valider.</li>
          <li style={li}><b>Évolution sur 6 mois</b> : dépenses et encaissements mois par mois.</li>
          <li style={li}><b>Répartition par catégorie</b> : où part l&apos;argent et d&apos;où il vient.</li>
        </ul>

        <h2 style={h2}>3. Dépenses et Encaissements (💳 / 💵)</h2>
        <p style={p}>Ces deux onglets fonctionnent de la même façon : un mois à la fois, avec les saisies de toute l&apos;équipe.</p>
        <h3 style={h3}>Ajouter une saisie – bouton + Ajouter</h3>
        <ol style={list}>
          <li style={li}>Déposez la photo ou le PDF de la facture : la date, le fournisseur et les montants se remplissent seuls. Si aucune année n&apos;est lisible, l&apos;année en cours est prise par défaut. Le justificatif est facultatif : vous pouvez l&apos;ajouter plus tard depuis la colonne Justificatif ou l&apos;onglet Comptable.</li>
          <li style={li}>Vérifiez l&apos;employé (vous par défaut), la catégorie, le mode de paiement et le montant.</li>
          <li style={li}>Paiement en <b>espèces</b> : indiquez si l&apos;argent passe par le <b>fond de caisse</b> ou par le <b>coffre fort</b>.</li>
          <li style={li}>Remplissez si besoin le <b>N° de facture/chèque</b> et la <b>description</b>.</li>
          <li style={li}>Cochez <b>Facture à envoyer au comptable</b> si elle doit partir dans son dossier du mois.</li>
          <li style={li}>Touchez <b>Enregistrer</b>.</li>
        </ol>
        <h3 style={h3}>Retrouver une saisie</h3>
        <p style={p}>Les filtres sous le titre se combinent : statut, employé, catégorie, paiement, et une recherche par fournisseur (par client ou description dans Encaissements). Le total se recalcule selon les filtres ; « Effacer les filtres » remet tout à zéro.</p>
        <h3 style={h3}>Corriger directement dans le tableau</h3>
        <Table head={['Colonne', "Ce qu'on peut faire"]} rows={[
          ['Date', 'Cliquer sur la date pour la changer. La saisie part dans le bon mois.'],
          ['Paiement', 'Choisir un autre mode dans la liste, y compris « Espèces · caisse » ou « Espèces · coffre ».'],
          ['Justificatif', '« Ajouter » pour joindre la facture si elle manque, ou l’ouvrir pour la consulter.'],
          ['Comptable', 'Cocher ou décocher pour l’envoi au comptable.'],
          ['Actions', '✓ pour valider, ↩ pour remettre en attente, 🗑 pour supprimer (avec confirmation).'],
        ]} />
        <p style={note}>Les saisies des employés arrivent « En attente » : vérifiez le montant et la facture, puis validez avec ✓. Une suppression est définitive, justificatif compris.</p>
        <p style={p}>Dans Encaissements, on saisit d&apos;abord le montant total et le mode de paiement, puis le bouton <b>🧾 Créer une facture client</b> du formulaire d&apos;ajout (ou, pour un encaissement déjà saisi, le bouton <b>🧾 Créer</b> de la colonne Facture) crée la facture client sur le papier à en-tête du riad : indiquez le nombre d&apos;adultes, d&apos;enfants de moins de 12 ans et de nuits, et ajoutez si besoin des lignes Restauration, Boissons, Spa, Transport ou Divers ; la taxe de séjour et taxe de promotion touristique (28 MAD par adulte et 18 MAD par enfant, par nuit) est déduite du montant encaissé, le reste correspond à l&apos;hébergement. La facture est toujours en dirhams. Les factures sont numérotées à la suite (FA-2026-0001, FA-2026-0002…) et partent directement dans l&apos;onglet Comptable. Le bouton <b>📊 Excel</b> de la barre du haut télécharge toutes les données dans un fichier Excel.</p>

        <p style={p}><b>🧾 À payer</b> (après Encaissements) : les factures des fournisseurs en attente de règlement. Une case par fournisseur affiche le reste à payer ; une facture dont la date limite est passée apparaît en rouge.</p>
        <Table head={['Fournisseur', 'Comment faire']} rows={[
          ['NDT, Renaisens', 'Une facture par mois : bouton + Facture, en indiquant le mois concerné.'],
          ['Elite Food, Berghout', 'À chaque commande, + Bon de commande (montant, n°, photo du bon). En fin de mois, + Facture : les bons du mois sont listés, cochés, et l’écart entre la facture et le total des bons s’affiche.'],
          ['Libre', '✏️ Libre (artisan, tapissier…) : nom libre, avec une zone de notes (acompte convenu, détail du travail…).'],
          ['💸 Payer', 'Montant payé maintenant : tout, ou un acompte. Il reste alors « Reste … » et le bouton devient 💸 Payer le solde. Chaque règlement crée sa dépense (Banque, Coffre ou Caisse) avec la facture pour le comptable ; ↩️ à côté d’un règlement l’annule.'],
          ['⚖️ Rapprochement', 'Chaque mois : facture reçue ou non pour chaque fournisseur, total des bons, écart, et bons oubliés dans la facture.'],
        ]} />

        <h2 style={h2}>4. Fond de caisse et Coffre fort (💰 / 🔐)</h2>
        <p style={p}>Les espèces vivent à deux endroits : la <b>caisse</b> (l&apos;argent du quotidien, visible par les employés) et le <b>coffre fort</b> (la réserve, visible seulement des administrateurs).</p>
        <h3 style={h3}>Fond de caisse</h3>
        <ul style={list}>
          <li style={li}>Le <b>solde</b> (MAD et EUR) se calcule tout seul : espèces encaissées moins espèces dépensées via la caisse, plus les transferts. C&apos;est le même chiffre pour toute l&apos;équipe.</li>
          <li style={li}><b>Rapprochement caisse</b> : saisissez ce que vous avez compté dans la caisse, l&apos;application affiche l&apos;écart. <b>✓ Enregistrer le rapprochement</b> le garde dans la liste « Derniers rapprochements » (les rapprochements des employés y apparaissent aussi).</li>
          <li style={li}><b>Transfert coffre fort ↔ fond de caisse</b> : pour remettre de l&apos;argent en caisse ou en ranger au coffre. Choisissez le sens, le montant et la devise ; le mouvement s&apos;inscrit des deux côtés en une fois.</li>
          <li style={li}>Pour annuler un transfert, utilisez le bouton de suppression dans la liste des mouvements : il disparaît des deux côtés.</li>
        </ul>
        <h3 style={h3}>Coffre fort</h3>
        <ul style={list}>
          <li style={li}><b>+ Ajouter</b> pour enregistrer une entrée ou une sortie du coffre. Un retrait au distributeur rangé au coffre se saisit en entrée, catégorie <b>Banque</b>.</li>
          <li style={li}>Les dépenses et encaissements saisis « Espèces · coffre » apparaissent aussi dans le coffre automatiquement.</li>
          <li style={li}><b>Solde DHS / Solde €</b> : le cumul depuis le début, ligne après ligne.</li>
          <li style={li}>Colonne <b>AF/SF</b> : AF = avec facture (cliquer pour l&apos;ouvrir), SF = sans facture. « SF 📎 » permet de joindre la facture après coup.</li>
          <li style={li}>Les lignes se valident avec ✓, comme les dépenses.</li>
        </ul>

        <h2 style={h2}>5. Banque (🏦)</h2>
        <p style={p}>L&apos;onglet Banque a quatre boutons en haut : <b>🏦 Mouvements</b>, <b>📄 Relevés Attijari</b>, <b>📄 Relevés CMI</b> et <b>📄 Relevés American Express</b>.</p>
        <p style={p}><b>Mouvements</b> : l&apos;onglet regroupe automatiquement tout ce qui n&apos;est pas payé en espèces : CB, virements, chèques, prélèvements. Il n&apos;y a rien à y saisir : tout vient de Dépenses et Encaissements.</p>
        <ul style={list}>
          <li style={li}><b>Solde net MAD</b> : le solde du compte selon l&apos;application. Il doit être égal au solde Attijari.</li>
          <li style={li}><b>Par mode de paiement</b> : les totaux CB, virement, chèque et prélèvement.</li>
          <li style={li}><b>Mouvements bancaires</b> : une ligne par opération, avec trois soldes cumulés.</li>
        </ul>
        <Table head={['Colonne', 'Signification']} rows={[
          ['Théorique', 'Solde en comptant toutes les opérations saisies'],
          ['Pointé', 'Case à cocher quand l’opération figure sur le relevé Attijari'],
          ['Réel', 'Solde en ne comptant que les opérations pointées'],
          ['Écart', 'Différence entre Théorique et Réel : les opérations pas encore passées en banque'],
        ]} />
        <p style={p}><b>Rapprocher avec Attijari</b> : ouvrez la liste des opérations sur la banque en ligne et cochez « Pointé » pour chaque ligne retrouvée. Une opération Attijari absente de l&apos;application est une saisie oubliée. Une ligne de l&apos;application absente du relevé est un doublon ou une opération pas encore débitée.</p>
        <h3 style={{ ...h2, fontSize: '0.95rem' }}>Les relevés Attijari, CMI et Amex</h3>
        <ul style={list}>
          <li style={li}>Chaque mois, ouvrez le sous-onglet de la banque, choisissez le <b>mois</b> (le mois précédent est proposé), puis <b>📤 Choisir le fichier</b> : PDF, photo, Excel ou CSV, 3 Mo maximum.</li>
          <li style={li}>Chaque relevé de la liste se consulte avec <b>👁 Voir</b>, se télécharge avec <b>⬇ Télécharger</b> et se supprime avec 🗑.</li>
          <li style={li}>Pour le comptable, les relevés du mois se regroupent dans <b>Comptable › Relevés bancaires</b> (voir plus bas).</li>
        </ul>

        <h3 style={{ ...h2, fontSize: '0.95rem' }}>Le contrôle du relevé Attijari</h3>
        <p style={p}><b>Quand</b> : le contrôle se lance tout seul quand vous déposez un relevé Attijari en <b>PDF ou en photo</b> (pas en Excel). Vous pouvez le relancer avec <b>🔍 Contrôler</b>, dans Banque › Relevés Attijari ou dans Comptable › Relevés bancaires.</p>
        <p style={p}><b>Comment</b> :</p>
        <ul style={list}>
          <li style={li}>Claude lit toutes les opérations du relevé (date, libellé, débit ou crédit) et les soldes de début et de fin. Cela prend une à deux minutes. La lecture est faite une seule fois par relevé et gardée ; <b>↻ Relire</b> la refait si elle semble incomplète.</li>
          <li style={li}>L&apos;application prend vos mouvements bancaires du mois (CB, virement, chèque, prélèvement, en dirhams, hors espèces) et cherche chaque ligne du relevé : <b>même montant</b>, avec jusqu&apos;à <b>7 jours d&apos;écart</b> de date (temps de passage en banque).</li>
          <li style={li}>Sans montant exact, elle cherche une saisie au <b>montant proche</b> (jusqu&apos;à 20 % d&apos;écart, à 5 jours près) : c&apos;est une erreur de frappe probable.</li>
          <li style={li}>Les <b>remises CMI et Amex</b> arrivent groupées : elles sont comparées au <b>total net</b> des encaissements carte du mois, pas ligne par ligne.</li>
          <li style={li}>La comparaison est refaite à chaque contrôle : après avoir corrigé une saisie, relancez <b>🔍 Contrôler</b> et le point corrigé disparaît.</li>
        </ul>
        <p style={p}><b>Le rapport</b> s&apos;affiche sous la liste des relevés :</p>
        <ul style={list}>
          <li style={li}>Un <b>bandeau vert</b> si tout correspond, <b>rouge</b> s&apos;il y a des points à vérifier, avec leur nombre.</li>
          <li style={li}>Un <b>tableau des totaux</b> (sorties, entrées, remises cartes) : chiffre du relevé, chiffre de l&apos;application et écart en rouge. « Grosse différence » est signalé au-delà de 500 MAD ou 5 % d&apos;écart.</li>
          <li style={li}>🔴 <b>Sur le relevé mais pas dans l&apos;application</b> : oublis (frais bancaires, prélèvement non saisi…) à ajouter dans Dépenses ou Encaissements.</li>
          <li style={li}>🟠 <b>Montant différent</b> : l&apos;opération du relevé à côté de la saisie correspondante, à corriger.</li>
          <li style={li}>🔵 <b>Dans l&apos;application mais pas sur le relevé</b> : erreur de saisie, doublon, ou opération pas encore passée en banque (elle apparaîtra sur le relevé suivant).</li>
        </ul>
        <p style={note}>Le résultat n&apos;est visible qu&apos;en ouvrant le rapport : il n&apos;y a pas de notification dans la cloche. Pensez à contrôler chaque relevé Attijari dès qu&apos;il est déposé.</p>

        <p style={note}>Fiez-vous à la liste en ligne d&apos;Attijari : l&apos;export CSV peut sauter des lignes. Pour corriger un écart qui reste inexpliqué, ajoutez une <b>ligne de régularisation datée</b> dans Dépenses ou Encaissements. Ne modifiez pas le solde initial : cela fausserait tous les mois passés.</p>

        <h2 style={h2}>6. Comptable (📨)</h2>
        <p style={p}>L&apos;onglet Comptable liste, mois par mois, toutes les saisies cochées « Facture à envoyer au comptable », en quatre rubriques : <b>Factures d&apos;achat</b> (dépenses), <b>Factures de vente</b> (encaissements), <b>Taxe de séjour et TPT</b> et <b>Relevés bancaires</b>.</p>
        <ul style={list}>
          <li style={li}>Choisissez le mois avec les flèches, ou cochez « Tous les mois ».</li>
          <li style={li}>Le nombre de <b>justificatifs manquants</b> s&apos;affiche en rouge. Sur chaque ligne sans facture, <b>+ Ajouter</b> permet de joindre la photo ou le PDF directement. La flèche ↻ remplace une facture déjà jointe.</li>
          <li style={li}><b>✕</b> retire une ligne de la liste du comptable, sans supprimer la saisie.</li>
          <li style={li}><b>📄 Exporter le PDF</b> crée le dossier du mois, par exemple « Comptable - Octobre 2026.pdf » : une page récapitulative avec les totaux, puis toutes les factures à la suite. Le récapitulatif indique la page de chaque facture, ou « manque ».</li>
        </ul>
        <p style={p}>Avant d&apos;exporter, vérifiez qu&apos;il ne reste aucun justificatif manquant pour le mois. Dans les factures de vente, le PDF exporté contient les factures clients générées par l&apos;application.</p>
        <p style={p}><b>Encaissements saisis par un employé</b> : l&apos;employé garde son écran habituel, sans facture. Son encaissement arrive directement dans Comptable › Factures de vente avec « 🧾 Compléter » : ouvrez-le pour indiquer le client, les adultes, enfants et nuits, la facture numérotée est alors créée.</p>
        <p style={p}><b>Relevés bancaires</b> : choisissez le mois avec les flèches : pour chaque banque, le relevé déposé s&apos;affiche, ou « Manquant » en rouge. <b>📄 Exporter les relevés</b> les réunit en un seul PDF pour le comptable (une page de garde, puis les relevés à la suite). Les relevés en Excel ou CSV ne peuvent pas entrer dans le PDF : ils sont signalés, à envoyer à part. <b>🔍 Contrôler le relevé Attijari</b> lance le même contrôle que dans Banque.</p>
        <p style={p}><b>Taxes de séjour</b> : choisissez le trimestre avec les flèches pour voir le total des nuitées et de la taxe à reverser. <b>📄 Relevé PDF</b> et <b>📊 Excel</b> créent le fichier à remettre au comptable. Le tableau donne, par facture, le nombre de personnes et de nuits ; la taxe vaut nuits × (adultes × 28 MAD + enfants de moins de 12 ans × 18 MAD) et elle est déduite du montant encaissé. Le tarif se modifie en haut à droite ; il s&apos;applique aux nouvelles factures seulement. Une facture se corrige à tout moment (son numéro ne change pas) ; seule la dernière facture de l&apos;année peut être supprimée.</p>

        <h2 style={h2}>7. Employés et Paramètres (👥 / ⚙️)</h2>
        <h3 style={h3}>Employés</h3>
        <ul style={list}>
          <li style={li}><b>+ Ajouter</b> : saisissez le nom et le poste. L&apos;employé reçoit un lien personnel.</li>
          <li style={li}><b>🔗 Copier lien</b> : copie ce lien pour l&apos;envoyer à l&apos;employé (WhatsApp, SMS). C&apos;est son seul accès, sans mot de passe. Dans son application, un bouton 📖 Mode d&apos;emploi lui explique tout.</li>
          <li style={li}><b>Donner accès manager</b> : son lien ouvre alors l&apos;interface manager au lieu de l&apos;interface employé. À réserver aux responsables, comme Nicolas.</li>
          <li style={li}><b>Désactiver</b> : le lien cesse de fonctionner (départ, lien perdu ou partagé). L&apos;historique de l&apos;employé est conservé, et <b>Réactiver</b> le rouvre.</li>
        </ul>
        <h3 style={h3}>Paramètres</h3>
        <ul style={list}>
          <li style={li}><b>Changer le PIN</b> de connexion manager.</li>
          <li style={li}><b>Mise à jour base de données</b> : à utiliser seulement si Sarah le demande après une mise à jour.</li>
        </ul>
        <p style={{ ...note, background: '#FEF2F2', borderColor: '#FCA5A5' }}>Les boutons d&apos;import (historique Banque, Coffre fort) et ceux en rouge (Vider les entrées, Zone dangereuse) ont servi une seule fois à la mise en place. <b>N&apos;y touchez pas</b> : relancer un import dupliquerait toutes les lignes, et les boutons rouges effacent des données définitivement.</p>

        <h2 style={h2}>8. La routine conseillée</h2>
        <Table head={['Quand', 'Quoi', 'Où']} rows={[
          ['Chaque jour', 'Valider les saisies « En attente » après avoir vérifié montant et facture', 'Dépenses, Encaissements'],
          ['Chaque jour', 'Comparer le solde de caisse avec le comptage (rapprochement)', 'Fond de caisse'],
          ['Chaque semaine', 'Pointer les opérations du relevé Attijari et vérifier que le Solde net MAD correspond', 'Banque'],
          ['Chaque semaine', 'Vérifier le solde du coffre et les sorties sans facture (SF)', 'Coffre fort'],
          ['Chaque mois', 'Cocher les factures pour le comptable et compléter les justificatifs manquants', 'Dépenses, Encaissements, Comptable'],
          ['Chaque mois', 'Exporter le PDF du mois et l’envoyer au comptable', 'Comptable'],
          ['Chaque mois', 'Déposer les relevés Attijari, CMI et Amex, lire le contrôle Attijari et corriger les écarts', 'Banque › Relevés'],
          ['Chaque mois', 'Exporter les relevés bancaires du mois et les envoyer au comptable', 'Comptable › Relevés bancaires'],
          ['Chaque semaine', 'Compléter les factures des encaissements saisis par les employés', 'Comptable › Factures de vente'],
          ['Chaque trimestre', 'Exporter le relevé de la taxe de séjour et TPT et l’envoyer au comptable', 'Comptable › Taxe de séjour et TPT'],
        ]} />
        <p style={p}>En cas de doute sur un chiffre ou d&apos;anomalie dans l&apos;application, notez la date et le montant concernés et prévenez Sarah.</p>

        <button onClick={onClose} className="btn-primary" style={{ width: '100%', marginTop: '1.5rem' }}>Retour à l&apos;application</button>
      </main>
    </div>
  )
}
