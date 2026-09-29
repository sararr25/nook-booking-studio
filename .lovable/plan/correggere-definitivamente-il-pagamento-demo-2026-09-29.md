# Correggere definitivamente il pagamento demo

## Diagnosi confermata
- L’ultima email di deposito è stata inviata correttamente alle 18:17.
- Il relativo link `/payment-demo/...` è stato raggiunto due volte alle 18:18 e ha risposto con pagina valida.
- Dopo quei clic, la prenotazione è rimasta `awaiting_deposit` e `deposit_paid_at` è rimasto vuoto.
- Quindi il problema è nel passaggio tra apertura della pagina e scrittura del pagamento, non nell’invio dell’email né nel solo aggiornamento visivo dell’owner.

## Intervento
1. Separare l’operazione di pagamento demo in una funzione esclusivamente server, richiamata direttamente durante il caricamento della pagina, evitando l’attuale passaggio indiretto tramite funzione remota dentro il loader.
2. Rendere l’aggiornamento atomico e idempotente:
   - accettare prenotazioni con deposito in `awaiting_deposit` e, solo se già autorizzate al pagamento, in `pending`;
   - scrivere insieme `deposit_paid_at` e `status = confirmed`;
   - rileggere il record e mostrare successo soltanto se entrambi risultano realmente salvati;
   - una seconda apertura dello stesso link deve continuare a mostrare successo;
   - non riattivare mai prenotazioni annullate.
3. Correggere il link email affinché punti sempre all’origine effettiva dell’app che ha inviato il messaggio, senza dipendere da un indirizzo preview fisso o potenzialmente obsoleto.
4. Dopo la conferma, mantenere la creazione idempotente dell’evento Google Calendar; un errore del calendario non deve annullare il pagamento già registrato.
5. Aggiornare subito la lista owner dopo il pagamento tramite il refresh già previsto, mostrando `Confirmed` e `Deposit paid` dai dati riletti dal database.
6. Migliorare l’errore della pagina: distinguere link non valido, prenotazione annullata ed errore di salvataggio, senza mostrare successo quando il database non è cambiato.

## Verifica
- Usare una prenotazione di prova isolata con deposito, senza toccare prenotazioni o clienti reali.
- Generare e ispezionare il link prodotto dallo stesso percorso email.
- Aprire quel link nella preview e verificare, in ordine:
  - pagina “Payment complete”;
  - `deposit_paid_at` valorizzato nel database;
  - stato `confirmed` nel database;
  - owner aggiornato con “Deposit paid”;
  - permanenza dello stato dopo ricarica;
  - seconda apertura del link ancora riuscita;
  - evento calendario non duplicato.
- Rimuovere i soli dati di prova, controllare la preview compilata e riportare l’esito puntuale.

## Vincoli preservati
- Nessun addebito reale o raccolta di carta.
- Nessuna modifica ai ruoli o alla sicurezza owner.
- Nessuna modifica alle prenotazioni/clienti esistenti.
- Il salvataggio `pending` quando Google Calendar non è verificabile resta invariato.
