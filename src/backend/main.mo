import OutCall "http-outcalls/outcall";

actor {
  public query func transform(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };

  public shared ({ caller }) func getPrayerTimes(city : Text, country : Text) : async Text {
    let url = "https://api.aladhan.com/v1/timingsByCity?city=" # city # "&country=" # country # "&method=2";
    await OutCall.httpGetRequest(url, [], transform);
  };
};
