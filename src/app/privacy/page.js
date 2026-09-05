import styles from "../legal.module.css";

// Publicly reachable without a login, because both app stores require the
// privacy policy URL to resolve for an unauthenticated reviewer.
//
// Everything below was written from the actual schema and client code, not
// from a template: the collection list mirrors the tables in
// supabase/migration-00-bootstrap-all.sql, and the deletion section describes
// what delete_own_account() really does (DELETE FROM auth.users, cascading
// through profiles and trip_members). If either changes, this page must
// change with it.

export const metadata = {
  title: "Privacy Policy — Wonder Georgia",
  description:
    "What the Wonder Georgia app collects, why, who processes it, and how to delete your account and data.",
};

const LAST_UPDATED = "3 September 2026";

export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <article className={styles.sheet}>
        <p className={styles.eyebrow}>Wonder Georgia</p>
        <h1 className={styles.title}>Privacy Policy</h1>
        <p className={styles.updated}>Last updated {LAST_UPDATED}</p>

        <div className={styles.callout}>
          <p>
            The short version: this app stores the email address and display name you sign up
            with, and the trip planning you type into it. It has no advertising, no analytics, no
            trackers, and it does not sell or share your data with anyone. You can delete your
            account and its data from inside the app at any time.
          </p>
        </div>

        <h2>Who this applies to</h2>
        <p>
          This policy covers the Wonder Georgia mobile app and its companion website. The
          service is operated by <span className={styles.todo}>[OPERATOR NAME]</span>, who you can
          reach at <span className={styles.todo}>[CONTACT EMAIL]</span>. Where data protection law
          uses the term, that operator is the data controller.
        </p>

        <h2>What we collect</h2>
        <p>
          <strong>Your account.</strong> The email address and password you sign up with, plus a
          display name and an emoji you pick for yourself. Passwords are handled by our
          authentication provider and stored only as a salted hash — nobody, including us, can
          read your password.
        </p>
        <p>
          <strong>What you put into a trip.</strong> Trip names and dates, which regions you
          shortlist, your votes on places, your star ratings, and any comments, place notes, trip
          notes and itinerary entries you write. Other members of a trip you join can see this
          content — that is the point of the app.
        </p>
        <p>
          <strong>Invitations.</strong> When you invite someone to a trip we store the invite code
          and, if you supply one, the email address you addressed it to. Invite codes expire.
        </p>
        <p>
          <strong>Trip members without accounts.</strong> A trip organiser can add family
          members — typically children — as participants who have no login of their own. For these
          we store only a display name and an emoji chosen by the organiser. No email, no
          password, no contact details, and no way for them to sign in.
        </p>
        <p>
          <strong>Technical records.</strong> Our hosting provider keeps standard server logs of
          requests to the service, which include an IP address and a timestamp, for security and
          for diagnosing faults.
        </p>

        <h2>What we do not collect</h2>
        <ul>
          <li>No location data. The app never asks for or receives your device location.</li>
          <li>No access to your camera, photos, microphone, contacts or calendar.</li>
          <li>No advertising identifiers, and no cross-app or cross-site tracking.</li>
          <li>No analytics or crash-reporting SDKs, and no third-party trackers of any kind.</li>
          <li>No payment details — the app does not take payments.</li>
        </ul>

        <h2>Why we use it</h2>
        <p>
          To sign you in and keep you signed in; to show your trip and its content to you and to
          the other members of that trip; to work out group consensus from everyone&rsquo;s votes
          and ratings; to let organisers manage who is in a trip; and to keep the service secure
          and working. We do not profile you and we do not make automated decisions about you.
        </p>

        <h2>Who else sees it</h2>
        <p>
          <strong>Other members of your trip</strong> see your display name, emoji, votes,
          ratings, comments and notes for that trip. They do not see your email address.
        </p>
        <p>
          <strong>Supabase</strong> hosts our database, authentication and file storage. They
          process this data on our instructions as a service provider, and nothing is stored
          outside their platform. Data is held in our project&rsquo;s hosting region,{" "}
          <span className={styles.todo}>[HOSTING REGION]</span>.
        </p>
        <p>
          That is the entire list. We do not sell your data, we do not share it for advertising,
          and we do not transfer it to anyone else except where the law actually requires it.
        </p>

        <h2>Children</h2>
        <p>
          The app is designed for an adult organising a trip, and accounts are intended for people
          aged 13 or over. Children typically appear in a trip as members added by a parent or
          organiser, holding nothing but a first name and an emoji, with no login and no contact
          details. If you believe a child has created their own account, contact us at{" "}
          <span className={styles.todo}>[CONTACT EMAIL]</span> and we will remove it.
        </p>

        <h2>Deleting your account and data</h2>
        <p>
          Open <strong>Account</strong> in the app and choose <strong>Delete my account</strong>.
          This happens immediately and cannot be undone. It permanently removes your login, your
          profile, your membership of every trip, and everything tied to that membership — your
          votes, your ratings, your comments and your calendar availability.
        </p>
        <p>
          To be straight with you about one thing: a trip you <em>created</em> is not deleted,
          because other people are still planning around it. You lose all access to it, and your
          membership and contributions are removed, but the trip itself and the notes and
          itinerary entries within it remain for the members who are still using it. If you want a
          trip you created deleted outright, ask us at{" "}
          <span className={styles.todo}>[CONTACT EMAIL]</span> before deleting your account.
        </p>
        <p>
          Server logs held by our hosting provider age out on their retention schedule and are not
          used to reconstruct a deleted account.
        </p>

        <h2>Your rights</h2>
        <p>
          Depending on where you live, you may have the right to see a copy of your data, to
          correct it, to have it deleted, to restrict or object to how it is used, and to receive
          it in a portable form. Deletion is built into the app, as described above. For anything
          else, write to <span className={styles.todo}>[CONTACT EMAIL]</span> and we will respond
          within 30 days. If you are in the UK, EU or EEA and you are unhappy with our response,
          you can complain to your national data protection authority.
        </p>

        <h2>Security</h2>
        <p>
          Traffic between the app and our servers is encrypted in transit. Every table that holds
          your data is protected by row-level access rules on the server, so one trip&rsquo;s
          content cannot be read by someone who is not a member of it, and every write goes
          through a checked server function rather than straight into the database. No system is
          perfect, but we do not keep data we do not need.
        </p>

        <h2>Changes to this policy</h2>
        <p>
          If we change how the app handles your data we will update this page and move the date at
          the top. Material changes will also be announced in the app.
        </p>

        <h2>Contact</h2>
        <p>
          Questions, requests or complaints:{" "}
          <span className={styles.todo}>[CONTACT EMAIL]</span>.
        </p>

        <p className={styles.footer}>
          Wonder Georgia · <a href="/support">Support</a>
        </p>
      </article>
    </main>
  );
}
