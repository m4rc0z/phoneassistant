# Latenz-Messungen: Google Speech-to-Text

Dieses Dokument protokolliert die Latenzmessungen für die Streaming-Transkription einer lokalen Audiodatei, um die Eignung für Echtzeit-Telefonie zu bewerten.

Die Latenz wird gemessen als die Zeit vom Senden des ersten Audio-Chunks bis zum Empfang des finalen Transkripts.

---

* **Testlauf 1 (2025-10-27T20:49:25.952Z)**
  * **Transkript:** "hello this is a test for speech recognition at 16 kilohertz"
  * **Latenz:** 
1521 ms

* **Testlauf 2 (2025-10-27T20:49:28.503Z)**
  * **Transkript:** "hello this is a test for speech recognition at 16 kilohertz"
  * **Latenz:** 
1545 ms

* **Testlauf 3 (2025-10-27T20:49:31.225Z)**
  * **Transkript:** "hello this is a test for speech recognition at 16 kilohertz"
  * **Latenz:** 
1716 ms

* **Testlauf 1 (2025-10-27T20:53:09.727Z)**
  * **Transkript:** "hello this is a test for speech recognition at 16 kilohertz"
  * **Latenz:** 
1386 ms

* **Testlauf 2 (2025-10-27T20:53:12.237Z)**
  * **Transkript:** "hello this is a test for speech recognition at 16 kilohertz"
  * **Latenz:** 
1503 ms

* **Testlauf 1 (2025-10-27T20:54:22.874Z)**
  * **Transkript:** "hello this is a test for speech recognition at 16 kilohertz"
  * **Latenz:** 
1417 ms

* **Testlauf 2 (2025-10-27T20:54:25.247Z)**
  * **Transkript:** "hello this is a test for speech recognition at 16 kilohertz"
  * **Latenz:** 
1365 ms


---
## Latenz-Messungen (Hot Stream)
*Simuliert ein laufendes Gespräch: 2s Stille zum Aufwärmen, dann Messung der Latenz für die Sprache.*

* **Testlauf 1 (2025-10-27T21:00:01.476Z)**
  * **Erstes Transkript:** "hello" (isFinal: false)
  * **Hot Stream Latenz:** 
735 ms

* **Testlauf 2 (2025-10-27T21:00:05.261Z)**
  * **Erstes Transkript:** "hello" (isFinal: false)
  * **Hot Stream Latenz:** 
660 ms
