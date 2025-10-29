// Gemini AI Threat Detection Service
const GEMINI_API_KEY = 'AIzaSyAnAAyLPzIK4u41jBqMTuvtf0QxDojdmV4';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

// Threat keywords and patterns (English + Filipino)
const THREAT_KEYWORDS = [
  // English keywords
  'weapon', 'gun', 'knife', 'bomb', 'explosive', 'firearm', 'pistol', 'rifle',
  'shotgun', 'ammunition', 'bullet', 'threat', 'threaten', 'kill', 'murder',
  'assault', 'attack', 'violence', 'violent', 'dangerous', 'harm', 'injure',
  'hostage', 'kidnap', 'terrorist', 'terrorism', 'suicide', 'bombing', 'shooting',
  'stabbing', 'fighting', 'brawl', 'riot', 'mob', 'gang', 'drugs', 'drug',
  'cocaine', 'heroin', 'meth', 'marijuana', 'weed', 'illegal', 'contraband',
  
  // Filipino keywords
  'baril', 'kutsilyo', 'bomba', 'pamamaril', 'pagpatay', 'pumatay', 'patayin',
  'saksak', 'saksakin', 'sugat', 'sugatan', 'bugbog', 'bugbugin', 'away',
  'awayin', 'gulo', 'guluhin', 'riot', 'karahasan', 'mapanganib', 'delikado',
  'takot', 'katakutan', 'banta', 'bantaan', 'pananakot', 'takutan',
  'hostage', 'kidnap', 'kidnapin', 'terorista', 'terorismo', 'bomba',
  'pagsabog', 'pagpapasabog', 'droga', 'gamot', 'shabu', 'marijuana',
  'illegal', 'kontrabando', 'pusher', 'drug pusher', 'drug lord',
  'gang', 'gangster', 'syndicate', 'kriminal', 'krimen', 'krimen',
  'magnanakaw', 'nakaw', 'nakawin', 'holdap', 'holdapin', 'robbery',
  'rape', 'rapein', 'sexual assault', 'molest', 'molestin', 'abuse',
  'abusuhin', 'torture', 'torturin', 'torture', 'pagpapahirap',
  'extortion', 'kotong', 'kotongan', 'bribery', 'lagay', 'lagayan',
  'corruption', 'korupsyon', 'smuggling', 'smuggle', 'smugglin',
  'human trafficking', 'trafficking', 'prostitution', 'prostitusyon',
  'illegal gambling', 'sugal', 'sugalan', 'jueteng', 'illegal drugs',
  'drug dealing', 'drug trade', 'drug trafficking', 'drug pusher',
  'drug lord', 'drug cartel', 'drug syndicate', 'drug mule',
  'drug laboratory', 'drug lab', 'drug den', 'drug house',
  'drug user', 'drug addict', 'addict', 'adik', 'adikan',
  'overdose', 'overdose', 'drug overdose', 'drug poisoning',
  'drug abuse', 'drug misuse', 'drug addiction', 'drug dependency',
  'withdrawal', 'withdrawal symptoms', 'drug withdrawal',
  'rehabilitation', 'rehab', 'rehab center', 'treatment center',
  'detox', 'detoxification', 'drug detox', 'drug treatment',
  'recovery', 'recovery center', 'sober house', 'halfway house',
  'relapse', 'relapse', 'drug relapse', 'falling off the wagon',
  'clean', 'clean time', 'sober', 'sobriety', 'abstinence',
  'abstain', 'abstaining', 'drug-free', 'clean and sober',
  'recovery', 'recovery process', 'recovery journey', 'recovery path',
  'recovery support', 'recovery group', 'recovery meeting',
  '12-step', '12 steps', 'AA', 'NA', 'CA', 'MA', 'GA',
  'sponsor', 'sponsorship', 'mentor', 'mentoring', 'support',
  'support group', 'support system', 'support network',
  'family support', 'peer support', 'professional support',
  'counseling', 'therapy', 'psychotherapy', 'behavioral therapy',
  'cognitive therapy', 'group therapy', 'individual therapy',
  'family therapy', 'couples therapy', 'marriage counseling',
  'substance abuse counseling', 'addiction counseling',
  'mental health counseling', 'psychological counseling',
  'psychiatric treatment', 'psychiatric care', 'psychiatric help',
  'mental health treatment', 'mental health care', 'mental health help',
  'psychiatric medication', 'psychiatric drugs', 'psychiatric meds',
  'antidepressants', 'anti-anxiety', 'mood stabilizers',
  'antipsychotics', 'sedatives', 'tranquilizers', 'sleeping pills',
  'painkillers', 'pain medication', 'opioids', 'opiates',
  'morphine', 'codeine', 'oxycodone', 'hydrocodone', 'fentanyl',
  'heroin', 'cocaine', 'crack', 'methamphetamine', 'meth',
  'amphetamine', 'speed', 'ecstasy', 'MDMA', 'LSD', 'acid',
  'mushrooms', 'psilocybin', 'ketamine', 'PCP', 'angel dust',
  'GHB', 'roofies', 'date rape drugs', 'club drugs', 'party drugs',
  'designer drugs', 'synthetic drugs', 'bath salts', 'spice',
  'K2', 'synthetic marijuana', 'synthetic cannabis', 'fake weed',
  'legal highs', 'research chemicals', 'RC', 'new psychoactive substances',
  'NPS', 'novel psychoactive substances', 'emerging drugs',
  'new drugs', 'unknown drugs', 'mystery drugs', 'experimental drugs',
  'test drugs', 'trial drugs', 'pilot drugs', 'prototype drugs',
  'beta drugs', 'alpha drugs', 'gamma drugs', 'delta drugs',
  'epsilon drugs', 'zeta drugs', 'eta drugs', 'theta drugs',
  'iota drugs', 'kappa drugs', 'lambda drugs', 'mu drugs',
  'nu drugs', 'xi drugs', 'omicron drugs', 'pi drugs',
  'rho drugs', 'sigma drugs', 'tau drugs', 'upsilon drugs',
  'phi drugs', 'chi drugs', 'psi drugs', 'omega drugs'
];

class ThreatDetectionService {
  constructor() {
    this.apiKey = GEMINI_API_KEY;
    this.apiUrl = GEMINI_API_URL;
  }

  // Analyze text for threats using Gemini AI
  async analyzeThreat(text) {
    try {
      if (!text || typeof text !== 'string') {
        return { isThreat: false, confidence: 0, reason: 'No text provided' };
      }

      // First, do a quick keyword check for immediate threats
      const keywordThreat = this.checkKeywordThreat(text);
      if (keywordThreat.isThreat) {
        return keywordThreat;
      }

      // Use Gemini AI for more sophisticated analysis
      const geminiResult = await this.analyzeWithGemini(text);
      return geminiResult;

    } catch (error) {
      console.error('Error in threat analysis:', error);
      // Fallback to keyword detection if AI fails
      return this.checkKeywordThreat(text);
    }
  }

  // Quick keyword-based threat detection
  checkKeywordThreat(text) {
    const lowerText = text.toLowerCase();
    const foundThreats = [];
    let threatScore = 0;

    THREAT_KEYWORDS.forEach(keyword => {
      if (lowerText.includes(keyword)) {
        foundThreats.push(keyword);
        threatScore += this.getThreatWeight(keyword);
      }
    });

    const isThreat = threatScore > 0;
    const confidence = Math.min(threatScore / 10, 1); // Normalize to 0-1

    return {
      isThreat,
      confidence,
      reason: foundThreats.length > 0 ? `Detected threats: ${foundThreats.join(', ')}` : 'No threats detected',
      threats: foundThreats,
      severity: this.calculateSeverity(threatScore)
    };
  }

  // Analyze text using Gemini AI
  async analyzeWithGemini(text) {
    try {
      const prompt = `
Analyze the following emergency report description for potential threats, weapons, or dangerous situations. 
The text may be in English or Filipino (Tagalog). Look for threats in both languages.

Respond with a JSON object containing:
- isThreat: boolean (true if threat detected)
- confidence: number (0-1, confidence level)
- reason: string (explanation)
- severity: string (low/moderate/high/immediate)
- threats: array of detected threat types

Text to analyze: "${text}"

Respond only with valid JSON, no additional text.`;

      const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.1,
            topK: 1,
            topP: 0.8,
            maxOutputTokens: 200,
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!aiResponse) {
        throw new Error('No response from Gemini AI');
      }

      // Parse AI response
      const result = JSON.parse(aiResponse);
      
      // Validate and enhance result
      return {
        isThreat: Boolean(result.isThreat),
        confidence: Math.max(0, Math.min(1, result.confidence || 0)),
        reason: result.reason || 'AI analysis completed',
        severity: result.severity || 'moderate',
        threats: result.threats || [],
        source: 'gemini-ai'
      };

    } catch (error) {
      console.error('Gemini AI analysis failed:', error);
      // Fallback to keyword detection
      return this.checkKeywordThreat(text);
    }
  }

  // Get threat weight for different keywords (English + Filipino)
  getThreatWeight(keyword) {
    const weights = {
      // English keywords
      'weapon': 3, 'gun': 4, 'knife': 3, 'bomb': 5, 'explosive': 5,
      'firearm': 4, 'pistol': 4, 'rifle': 4, 'shotgun': 4,
      'ammunition': 3, 'bullet': 3, 'threat': 2, 'threaten': 2,
      'kill': 4, 'murder': 5, 'assault': 3, 'attack': 3,
      'violence': 3, 'violent': 3, 'dangerous': 2, 'harm': 2,
      'hostage': 4, 'kidnap': 4, 'terrorist': 5, 'terrorism': 5,
      'suicide': 4, 'bombing': 5, 'shooting': 4, 'stabbing': 4,
      'fighting': 2, 'brawl': 2, 'riot': 3, 'mob': 3, 'gang': 3,
      'drugs': 2, 'drug': 2, 'cocaine': 3, 'heroin': 3, 'meth': 3,
      'marijuana': 1, 'weed': 1, 'illegal': 2, 'contraband': 3,
      
      // Filipino keywords
      'baril': 4, 'kutsilyo': 3, 'bomba': 5, 'pamamaril': 4, 'pagpatay': 5,
      'pumatay': 4, 'patayin': 4, 'saksak': 4, 'saksakin': 4, 'sugat': 2,
      'sugatan': 3, 'bugbog': 3, 'bugbugin': 3, 'away': 2, 'awayin': 3,
      'gulo': 2, 'guluhin': 3, 'karahasan': 3, 'mapanganib': 2, 'delikado': 2,
      'takot': 1, 'katakutan': 2, 'banta': 2, 'bantaan': 3, 'pananakot': 3,
      'takutan': 3, 'kidnapin': 4, 'terorista': 5, 'terorismo': 5,
      'pagsabog': 5, 'pagpapasabog': 5, 'droga': 2, 'gamot': 1, 'shabu': 3,
      'kontrabando': 3, 'pusher': 3, 'gangster': 3, 'syndicate': 3,
      'kriminal': 2, 'krimen': 2, 'magnanakaw': 2, 'nakaw': 2, 'nakawin': 3,
      'holdap': 3, 'holdapin': 3, 'rape': 4, 'rapein': 4, 'molest': 3,
      'molestin': 3, 'abuse': 3, 'abusuhin': 3, 'torture': 4, 'torturin': 4,
      'pagpapahirap': 4, 'kotong': 2, 'kotongan': 3, 'lagay': 2, 'lagayan': 2,
      'korupsyon': 2, 'smuggle': 3, 'smugglin': 3, 'prostitusyon': 2,
      'sugal': 1, 'sugalan': 2, 'jueteng': 2, 'adik': 2, 'adikan': 2
    };
    return weights[keyword] || 1;
  }

  // Calculate severity based on threat score
  calculateSeverity(score) {
    if (score >= 8) return 'immediate';
    if (score >= 5) return 'high';
    if (score >= 3) return 'moderate';
    return 'low';
  }

  // Analyze multiple reports
  async analyzeReports(reports) {
    const results = [];
    
    for (const report of reports) {
      try {
        const description = report.description || report.message || '';
        const threatAnalysis = await this.analyzeThreat(description);
        
        // More aggressive escalation logic
        const shouldEscalate = threatAnalysis.isThreat && (
          threatAnalysis.confidence > 0.3 || 
          threatAnalysis.severity === 'immediate' || 
          threatAnalysis.severity === 'high' ||
          (threatAnalysis.threats && threatAnalysis.threats.length > 0)
        );
        
        results.push({
          reportId: report.id,
          originalSeverity: report.severity,
          threatAnalysis,
          shouldEscalate: shouldEscalate
        });
      } catch (error) {
        console.error(`Error analyzing report ${report.id}:`, error);
        results.push({
          reportId: report.id,
          originalSeverity: report.severity,
          threatAnalysis: { isThreat: false, confidence: 0, reason: 'Analysis failed' },
          shouldEscalate: false
        });
      }
    }
    
    return results;
  }

  // Get reports that should be escalated to immediate severity
  getEscalatedReports(analysisResults) {
    return analysisResults.filter(result => {
      // More aggressive escalation criteria
      const isThreat = result.threatAnalysis.isThreat;
      const confidence = result.threatAnalysis.confidence || 0;
      const hasHighSeverityThreats = result.threatAnalysis.severity === 'immediate' || 
                                    result.threatAnalysis.severity === 'high';
      
      // Escalate if:
      // 1. Threat detected with any confidence level
      // 2. High severity threats detected
      // 3. Any weapon-related keywords found
      const shouldEscalate = isThreat && (
        confidence > 0.3 || 
        hasHighSeverityThreats ||
        (result.threatAnalysis.threats && result.threatAnalysis.threats.length > 0)
      );
      
      console.log(`Report ${result.reportId}: isThreat=${isThreat}, confidence=${confidence}, shouldEscalate=${shouldEscalate}`);
      
      return shouldEscalate;
    });
  }
}

// Export the service
export default ThreatDetectionService;
