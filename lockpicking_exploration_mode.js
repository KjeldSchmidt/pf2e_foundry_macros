const colors = {
  critical_success: 'rgb(0, 128, 0)',
  success: 'rgb(0, 0, 255)',
  failure: 'rgb(255, 69, 0)',
  critical_failure: 'rgb(255, 0, 0)',
}

class Lock {
  constructor(required_successes, dc, quality_name) {
    this.required_successes = required_successes;
    this.dc = dc;
    this.quality_name = quality_name;
  }
}

const locks = {
  poor: new Lock(2, 15, "Poor"),
  simple: new Lock(3, 20, "Simple"),
  average: new Lock(4, 25, "Average"),
  good: new Lock(5, 30, "Good"),
  superior: new Lock(6, 40, "Superior"),
};


async function determine_lockpicking_success(bonuses, dc) {
  const roll = await new Roll('1d20').roll();
  game.dice3d?.showForRoll(roll);
  roll_value = roll._total;
  const check_value = roll_value + bonuses;
  
  let success_value = 0;
  if (check_value >= dc + 10) { success_value = 2; }
  else if (check_value >= dc) { success_value = 1; }
  else if (check_value >= dc - 9) { success_value = 0; }
  else if (check_value <= dc - 10) { success_value = -1; }

  if (roll_value == 20) { success_value = Math.min(2, success_value + 1) }
  if (roll_value == 1) { success_value = Math.max(-1, success_value - 1) }

  return [success_value, check_value];
}

const is_overall_crit_failure = (pick_success_degrees) => pick_success_degrees.includes(-1);
const is_overall_crit_success = (pick_success_degrees) => pick_success_degrees.every(num => num === 2);

function get_title_html(lock, pick_success_degrees) {
  let result_line = "";
  if (is_overall_crit_failure(pick_success_degrees)) {
    result_text = "Critical Failure";
    result_color = colors.critical_failure;
  } else if (is_overall_crit_success(pick_success_degrees)) {
    result_text = "Critical Success";
    result_color = colors.critical_success;
  } else {
    result_text = "Success";
    result_color = colors.success;
  }
  return `
    <span style="font-size: var(--font-size-12);">
      <h4 class="action">
        <strong>Pick a Lock</strong>
        <span class="subtitle">(<span>Thievery Check</span>)</span>
      </h4>
      <div class="target-dc-result">
        <div class="target-dc">
          <span>Target: ${lock.quality_name} Lock</span> <span>(DC ${lock.dc})</span>
        </div>
        <div>Result: <span style="color:${result_color}">${result_text}</span></div>
      </div>
    </span>
  `
}

function get_lockpicking_traits_html() {
  return `
    <div class="tags traits" data-tooltip-class="pf2e">
      <span class="tag" data-slug="manipulate" data-tooltip="PF2E.TraitDescriptionManipulate">Manipulate</span>
    </div>
  `
}

function get_thievery_modifiers_html() {
  signed = (num) => `${num >= 0 ? "+" : ""}${num}`

  let = modifiers = actor.skills.thievery.modifiers;
  modifiers = modifiers.filter(item => item.enabled);
  let modifier_tags = modifiers.map((mod) => `<span class="tag tag_transparent" data-slug="${mod.slug}}">${mod.label} ${signed(mod.modifier)}</span>`);


  const modifier_tag_div = `
    <div class="tags modifiers">
      ${modifier_tags.join("\n")}
    </div>
  `;

  return modifier_tag_div;
}

function chat_print_lockpicking_summary(number_of_progresses, pick_success_degrees, lock) {
  const success_summary = `<p>Success after ${pick_success_degrees.length} rounds.`
  const failure_summary = `<p>After ${pick_success_degrees.length} rounds and ${number_of_progresses} out of ${lock.required_successes} set pins, the pick broke.</p>`
  const summary = is_overall_crit_failure(pick_success_degrees) ? failure_summary : success_summary;
  
  let scratch_summary = "You left behind damage that indicates the lock was picked on close scrutiny.";
  if (is_overall_crit_success(pick_success_degrees)) { scratch_summary = "No visible damage was left on the lock."; } 
  if (is_overall_crit_failure(pick_success_degrees)) { scratch_summary = "You leave behind obvious damage."; }


  ChatMessage.create({
    content: `
      ${get_title_html(lock, pick_success_degrees)}
      ${get_lockpicking_traits_html()}
      <hr />
      ${get_thievery_modifiers_html()}
      ${summary}
      <p>${scratch_summary}</p>
    `,
    speaker: ChatMessage.getSpeaker({ actor }),
    user: game.user.id
  });
}



await Dialog.prompt({
  title: 'Lockpick',
  content: `
    <div class="form-group" style="padding: 0.5rem 0;">
      <label for="lockSelect">Lock Quality</label>
      <select name="lockSelect" style="float: right">
        <option value="poor">Poor (2, DC15)</option>
        <option value="simple">Simple (3, DC20)</option>
        <option value="average">Average (4, DC25)</option>
        <option value="good">Good (5, DC30)</option>
        <option value="superior">Superior (6, DC40)</option>
      </select>
      <br />
      <div style="margin: 1rem 0;">
        <label for="bonuses" style="float: left">Other Bonuses</label>
        <input type='number' name='bonuses' value=0 style="width: 60%; float: right" />
      </div>
    </div>
  `,

  callback: async(html) => {
    const lock_name = html.find('[name="lockSelect"]').val();
    const lock = locks[lock_name];
    const other_bonuses = parseInt(html.find('[name="bonuses"]').val());

    let actual_progress_count = 0;
    const pick_success_degrees = [];
    const pick_check_values = [];
    let crit_failed = false;
    const total_bonus = parseInt(actor.skills.thievery.check.mod) + other_bonuses;

    while (actual_progress_count < lock.required_successes && !crit_failed) {
      const [new_successes, check_value] = await determine_lockpicking_success(total_bonus, lock.dc);
      pick_success_degrees.push(new_successes);
      pick_check_values.push(check_value);
      
      if (new_successes == -1) {
        crit_failed = true;
        continue;
      }

      actual_progress_count += new_successes;
    }

    chat_print_lockpicking_summary(actual_progress_count, pick_success_degrees, lock);
  }
});