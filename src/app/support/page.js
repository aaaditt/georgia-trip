import styles from "../legal.module.css";

// The "Support URL" both stores demand. Apple additionally expects an app
// with user-generated content to make its reporting and blocking route
// discoverable, so the moderation section here mirrors what
// src/lib/moderation.ts actually implements (report a comment, block a
// member, unblock them again) rather than promising a process we do not have.

export const metadata = {
  title: "Support — Georgia Trip Planner",
  description:
    "Help with the Georgia Trip Planner app: getting started, joining a trip, reporting content, and deleting your account.",
};

export default function SupportPage() {
  return (
    <main className={styles.page}>
      <article className={styles.sheet}>
        <p className={styles.eyebrow}>Georgia Trip Planner</p>
        <h1 className={styles.title}>Support</h1>
        <p className={styles.updated}>
          Email <span className={styles.todo}>[CONTACT EMAIL]</span> — we aim to reply within two
          working days.
        </p>

        <div className={styles.callout}>
          <p>
            Georgia Trip Planner is a group trip planner for the country of Georgia. One person
            creates a trip, invites everyone else with a code, and the group shortlists regions
            and votes on places until an itinerary falls out of it. It ships with a researched
            catalogue of places across ten regions, so nobody has to type in a list to get
            started.
          </p>
        </div>

        <h2>Getting started</h2>
        <p>
          Sign up with an email address, a password and the name you want the group to see. Then
          either create a trip or join one.
        </p>
        <p>
          <strong>Creating a trip</strong> takes three steps: name it, pick the dates, then choose
          the regions of Georgia you are interested in. The app fills the trip with the places in
          those regions automatically — you do not add them by hand.
        </p>
        <p>
          <strong>Joining a trip</strong> needs the invite code from whoever created it. Open
          Join, paste the code, and you are in. Codes expire after two weeks, so ask for a fresh
          one if yours is refused.
        </p>

        <h2>How the planning works</h2>
        <p>
          Every place can be voted on — go, maybe or skip — and rated out of five. The consensus
          screen turns those votes into a ranking so the group can see what it actually agrees
          about rather than arguing from memory. The calendar unlocks once the group has voted on
          the regions it shortlisted, and you can leave notes on individual places or on the trip
          as a whole.
        </p>
        <p>
          Regions you did not shortlist are not hidden. Explore lists all of Georgia, everything
          in it is browsable and votable, and you can pull a region into your shortlist at any
          time if the plan changes.
        </p>

        <h2>Reporting content, and blocking someone</h2>
        <p>
          Trips are private and invite-only, so the people in yours are people someone invited.
          If a comment is still offensive or inappropriate:
        </p>
        <ul>
          <li>
            <strong>Report the comment.</strong> Open the place it is on and use the report action
            on that comment. It goes to the trip&rsquo;s organiser for review.
          </li>
          <li>
            <strong>Block the person.</strong> Blocking hides everything they write from you
            straight away, across the whole trip, and does not tell them. You can unblock later.
          </li>
          <li>
            <strong>Tell us.</strong> For anything serious, or anything an organiser will not
            deal with, email <span className={styles.todo}>[CONTACT EMAIL]</span>. Include the
            trip name and roughly when it was posted. We act on reports of abusive or illegal
            content within one working day, and we can remove content and accounts outright.
          </li>
        </ul>
        <p>
          Trip organisers can also remove a member from a trip, which revokes their access to
          everything in it.
        </p>

        <h2>Common problems</h2>
        <p>
          <strong>My invite code will not work.</strong> Codes expire after 14 days and each one
          is single-use. Ask the organiser to send a new one.
        </p>
        <p>
          <strong>I cannot see any places.</strong> Places arrive with the regions you shortlist.
          If your trip was created before the catalogue existed, open the dashboard and use the
          option to add Georgia&rsquo;s places.
        </p>
        <p>
          <strong>The calendar is locked.</strong> It unlocks once the group has voted on the
          places in the regions you shortlisted. It does not require votes on all of Georgia.
        </p>
        <p>
          <strong>Someone&rsquo;s changes are not showing up.</strong> Votes, comments and notes
          sync live, so this is almost always a connection problem. Pull to refresh, and check
          you have signal.
        </p>

        <h2>Deleting your account</h2>
        <p>
          Open <strong>Account</strong> and choose <strong>Delete my account</strong>. It is
          immediate and permanent: your login, profile, trip memberships, votes, ratings and
          comments all go. Trips you created stay for the other members, and you lose access to
          them — if you want one deleted outright, email us before you delete your account.
        </p>

        <h2>Still stuck?</h2>
        <p>
          Email <span className={styles.todo}>[CONTACT EMAIL]</span>. Telling us your device, the
          app version and what you were doing when it went wrong gets you a useful answer much
          faster.
        </p>

        <p className={styles.footer}>
          Georgia Trip Planner · <a href="/privacy">Privacy Policy</a>
        </p>
      </article>
    </main>
  );
}
