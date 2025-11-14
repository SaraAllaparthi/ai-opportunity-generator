/**
 * Validate and cap ROI to realistic percentages based on industry benchmarks
 * Typical AI projects: 20-100% ROI, exceptional: 100-200%, anything above 200% is unrealistic
 * 
 * @param roiPct - Raw ROI percentage
 * @returns Validated ROI percentage capped at realistic levels
 */
export function validateROI(roiPct: number): number {
  // Cap ROI at 250% maximum (allows some exceptional cases but prevents extreme inflation)
  // If ROI is above 200%, apply a scaling factor to bring it down
  if (roiPct > 250) {
    // For extremely high ROI (>250%), cap at 250% and log warning
    console.warn(`[ROI Validation] Capping unrealistic ROI from ${roiPct}% to 250%`)
    return 250
  } else if (roiPct > 200) {
    // For ROI between 200-250%, apply conservative scaling (bring closer to 200%)
    const scaled = 200 + (roiPct - 200) * 0.3 // Scale down the excess above 200%
    console.warn(`[ROI Validation] Scaling down high ROI from ${roiPct}% to ${Math.round(scaled)}%`)
    return Math.round(scaled)
  }
  // ROI <= 200% is acceptable
  return Math.round(roiPct)
}

