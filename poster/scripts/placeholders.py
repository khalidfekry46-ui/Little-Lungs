import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt, numpy as np
plt.rcParams.update({'font.family': 'Liberation Serif', 'font.size': 19, 'axes.spines.top': False, 'axes.spines.right': False, 'savefig.dpi': 300, 'savefig.bbox': 'tight'})
AM, NAVY = '#C77A1E', '#0B1F45'
def ph(name, xl, yl, note, xlim, ylim, ref=None):
    fig, ax = plt.subplots(figsize=(10.5, 5.6))
    ax.set_xlim(*xlim); ax.set_ylim(*ylim); ax.set_xlabel(xl); ax.set_ylabel(yl)
    for s in ax.spines.values(): s.set_linestyle((0, (6, 5))); s.set_color(AM)
    if ref == 'identity': ax.plot(xlim, xlim, color='#9AA3B5', lw=2, ls='--'); ax.text(xlim[1] * 0.97, xlim[1] * 0.93, 'perfect agreement', ha='right', color='#5B6478', fontsize=16)
    ax.text(0.5, 0.55, 'DATA PENDING', transform=ax.transAxes, ha='center', fontsize=40, color=AM, alpha=0.35, fontweight='bold')
    ax.text(0.5, 0.36, note, transform=ax.transAxes, ha='center', va='top', fontsize=16, color='#8A4B00')
    fig.savefig(f'/home/claude/poster/figures/placeholder_{name}.png'); plt.close(fig)
ph('belt_calibration', 'Belt stretch measured with a tape (mm)', 'Pico W ADC reading (0–65535)', 'Stretch each belt in 5 mm steps (0–60 mm), 3 readings per step;\nfit a straight line and report R² and the ± error', (0, 60), (0, 65535))
ph('heart_rate', 'Reference pulse oximeter (bpm)', 'MAX30102 through the Pico W (bpm)', '≥ 20 paired readings from ≥ 10 people at rest;\nreport mean difference ± 1.96 SD (target ± 5 bpm)', (50, 120), (50, 120), 'identity')
ph('response_time', 'Placement verdicts (one bar per verdict)', 'Time from board still to verdict (s)', 'Log every verdict in the dry run and pilot;\nreport median and 95th percentile (target ≤ 2 s)', (0, 50), (0, 4))
ph('breath_classifier', 'Volunteer (leave-one-person-out)', 'Breaths labelled correctly (%)', '10 volunteers × 8 paced breaths, recorder labels as truth;\nreport accuracy with 95% Wilson interval (target ≥ 80%)', (0.5, 10.5), (0, 100))
print('ok')
